// OFX/OFC Parser for Brazilian bank statements

export interface OFXTransaction {
  id: string;
  type: "credit" | "debit";
  date: Date;
  amount: number;
  description: string;
  memo?: string;
  checkNumber?: string;
  refNumber?: string;
}

export interface OFXStatement {
  bankId: string;
  accountId: string;
  accountType: string;
  currency: string;
  startDate: Date;
  endDate: Date;
  balance: number;
  balanceDate: Date;
  transactions: OFXTransaction[];
}

export interface OFXParseResult {
  success: boolean;
  statement?: OFXStatement;
  error?: string;
}

function parseOFXDate(dateStr: string): Date {
  // OFX date format: YYYYMMDDHHMMSS or YYYYMMDD
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));
  
  let hour = 0, minute = 0, second = 0;
  if (dateStr.length >= 14) {
    hour = parseInt(dateStr.substring(8, 10));
    minute = parseInt(dateStr.substring(10, 12));
    second = parseInt(dateStr.substring(12, 14));
  }
  
  return new Date(year, month, day, hour, minute, second);
}

function extractValue(content: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<\\n]+)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function extractBlock(content: string, tag: string): string | null {
  const startTag = `<${tag}>`;
  const endTag = `</${tag}>`;
  const startIndex = content.indexOf(startTag);
  
  if (startIndex === -1) return null;
  
  const endIndex = content.indexOf(endTag, startIndex);
  if (endIndex === -1) {
    // Some OFX files don't have closing tags
    const nextTagIndex = content.indexOf('<', startIndex + startTag.length);
    if (nextTagIndex === -1) return null;
    return content.substring(startIndex + startTag.length, nextTagIndex);
  }
  
  return content.substring(startIndex + startTag.length, endIndex);
}

function parseTransactions(content: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi;
  
  let match;
  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const trnContent = match[1];
    
    const trnType = extractValue(trnContent, 'TRNTYPE');
    const dtPosted = extractValue(trnContent, 'DTPOSTED');
    const trnAmt = extractValue(trnContent, 'TRNAMT');
    const fitId = extractValue(trnContent, 'FITID');
    const name = extractValue(trnContent, 'NAME');
    const memo = extractValue(trnContent, 'MEMO');
    const checkNum = extractValue(trnContent, 'CHECKNUM');
    const refNum = extractValue(trnContent, 'REFNUM');
    
    if (dtPosted && trnAmt) {
      const amount = parseFloat(trnAmt.replace(',', '.'));
      
      transactions.push({
        id: fitId || `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: amount >= 0 ? "credit" : "debit",
        date: parseOFXDate(dtPosted),
        amount: Math.abs(amount),
        description: name || memo || 'Transação sem descrição',
        memo: memo || undefined,
        checkNumber: checkNum || undefined,
        refNumber: refNum || undefined,
      });
    }
  }
  
  return transactions;
}

export function parseOFX(content: string): OFXParseResult {
  try {
    // Clean content - remove SGML headers if present
    const cleanContent = content
      .replace(/^[\s\S]*?<OFX>/i, '<OFX>')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    
    // Extract bank statement section
    const stmtrs = extractBlock(cleanContent, 'STMTRS') || 
                   extractBlock(cleanContent, 'CCSTMTRS'); // Credit card statements
    
    if (!stmtrs) {
      return { success: false, error: 'Arquivo OFX inválido: seção de extrato não encontrada' };
    }
    
    // Extract bank account info
    const bankAcctFrom = extractBlock(stmtrs, 'BANKACCTFROM') || 
                         extractBlock(stmtrs, 'CCACCTFROM');
    
    const bankId = bankAcctFrom ? extractValue(bankAcctFrom, 'BANKID') || '' : '';
    const accountId = bankAcctFrom ? extractValue(bankAcctFrom, 'ACCTID') || '' : '';
    const accountType = bankAcctFrom ? extractValue(bankAcctFrom, 'ACCTTYPE') || 'CHECKING' : 'CHECKING';
    
    // Extract currency
    const currency = extractValue(stmtrs, 'CURDEF') || 'BRL';
    
    // Extract transaction list info
    const bankTranList = extractBlock(stmtrs, 'BANKTRANLIST');
    
    let startDate = new Date();
    let endDate = new Date();
    
    if (bankTranList) {
      const dtStart = extractValue(bankTranList, 'DTSTART');
      const dtEnd = extractValue(bankTranList, 'DTEND');
      
      if (dtStart) startDate = parseOFXDate(dtStart);
      if (dtEnd) endDate = parseOFXDate(dtEnd);
    }
    
    // Parse transactions
    const transactions = parseTransactions(stmtrs);
    
    // Extract balance
    const ledgerBal = extractBlock(stmtrs, 'LEDGERBAL') || extractBlock(stmtrs, 'AVAILBAL');
    let balance = 0;
    let balanceDate = new Date();
    
    if (ledgerBal) {
      const balAmt = extractValue(ledgerBal, 'BALAMT');
      const dtAsOf = extractValue(ledgerBal, 'DTASOF');
      
      if (balAmt) balance = parseFloat(balAmt.replace(',', '.'));
      if (dtAsOf) balanceDate = parseOFXDate(dtAsOf);
    }
    
    return {
      success: true,
      statement: {
        bankId,
        accountId,
        accountType,
        currency,
        startDate,
        endDate,
        balance,
        balanceDate,
        transactions,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    };
  }
}

// Parse OFC format (older format used by some banks)
export function parseOFC(content: string): OFXParseResult {
  // OFC is essentially the same as OFX with minor differences
  // Try parsing as OFX first
  return parseOFX(content);
}

// Auto-detect format and parse
export function parseBankStatement(content: string, filename: string): OFXParseResult {
  const extension = filename.toLowerCase().split('.').pop();
  
  if (extension === 'ofc') {
    return parseOFC(content);
  }
  
  return parseOFX(content);
}
