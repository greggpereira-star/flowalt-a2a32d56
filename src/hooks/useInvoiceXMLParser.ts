import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export interface ParsedNFe {
  invoiceNumber: string;
  series: string;
  accessKey: string;
  issueDate: string;
  dueDate?: string;
  grossAmount: number;
  netAmount: number;
  taxAmount: number;
  taxes: {
    icms?: number;
    pis?: number;
    cofins?: number;
    ipi?: number;
    iss?: number;
    irrf?: number;
    csll?: number;
  };
  emitter: {
    name: string;
    document: string;
    email?: string;
  };
  recipient: {
    name: string;
    document: string;
    email?: string;
  };
  description: string;
  items: Array<{
    description: string;
    quantity: number;
    unitValue: number;
    totalValue: number;
  }>;
  invoiceType: 'nfe' | 'nfse' | 'nfce';
}

// Parse NFe XML content
export function parseNFeXML(xmlContent: string): ParsedNFe | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
    
    // Check for parsing errors
    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
      console.error("XML parse error:", parseError.textContent);
      throw new Error("XML inválido");
    }

    // Debug: Log the root element to understand the XML structure
    console.log("XML root element:", xmlDoc.documentElement?.tagName);
    console.log("XML namespaces:", xmlDoc.documentElement?.getAttribute("xmlns"));

    // More comprehensive detection for NFe formats
    // Check for NFe by looking for common elements across different formats
    const hasNFeElements = 
      xmlDoc.getElementsByTagName("infNFe").length > 0 ||
      xmlDoc.getElementsByTagName("NFe").length > 0 ||
      xmlDoc.getElementsByTagName("nfeProc").length > 0 ||
      xmlDoc.querySelector("[Id*='NFe']") !== null ||
      xmlDoc.documentElement?.tagName?.includes("NFe") ||
      xmlDoc.documentElement?.tagName?.includes("nfeProc") ||
      // Check for elements that are unique to NFe
      xmlDoc.getElementsByTagName("ide").length > 0 ||
      xmlDoc.getElementsByTagName("emit").length > 0 ||
      xmlDoc.getElementsByTagName("dest").length > 0;

    // Check for NFSe formats
    const hasNFSeElements = 
      xmlDoc.getElementsByTagName("CompNfse").length > 0 ||
      xmlDoc.getElementsByTagName("Nfse").length > 0 ||
      xmlDoc.getElementsByTagName("InfNfse").length > 0 ||
      xmlDoc.getElementsByTagName("ListaNfse").length > 0 ||
      xmlDoc.getElementsByTagName("ConsultarNfseResposta").length > 0 ||
      // Check for elements unique to NFSe
      xmlDoc.getElementsByTagName("Prestador").length > 0 ||
      xmlDoc.getElementsByTagName("Tomador").length > 0 ||
      xmlDoc.getElementsByTagName("TomadorServico").length > 0;

    console.log("Has NFe elements:", hasNFeElements, "Has NFSe elements:", hasNFSeElements);

    if (hasNFSeElements && !hasNFeElements) {
      return parseNFSeXML(xmlDoc);
    } else if (hasNFeElements) {
      return parseNFeXMLContent(xmlDoc);
    }

    // If we still can't detect, try to parse as NFe anyway (most common)
    console.log("Could not detect XML type, attempting NFe parse...");
    const nfeResult = tryParseAsNFe(xmlDoc);
    if (nfeResult) {
      return nfeResult;
    }

    throw new Error("Formato de XML não reconhecido. Verifique se é um XML de NF-e ou NFS-e válido.");
  } catch (error) {
    console.error("Error parsing XML:", error);
    throw error;
  }
}

// Fallback NFe parser that tries to extract data even from non-standard formats
function tryParseAsNFe(xmlDoc: Document): ParsedNFe | null {
  const getElementText = (tagNames: string[]): string => {
    for (const tagName of tagNames) {
      const elements = xmlDoc.getElementsByTagName(tagName);
      if (elements.length > 0 && elements[0].textContent) {
        return elements[0].textContent.trim();
      }
    }
    return "";
  };

  const getNumber = (tagNames: string[]): number => {
    const value = getElementText(tagNames);
    return parseFloat(value) || 0;
  };

  // Try to extract essential data
  const invoiceNumber = getElementText(["nNF", "Numero", "NumeroNfse", "numero"]);
  const series = getElementText(["serie", "Serie"]) || "1";
  
  if (!invoiceNumber) {
    return null;
  }

  // Extract dates
  const dhEmi = getElementText(["dhEmi", "dEmi", "DataEmissao", "dataEmissao"]);
  const issueDate = dhEmi ? dhEmi.split("T")[0] : new Date().toISOString().split("T")[0];
  const dueDate = getElementText(["dVenc", "DataVencimento"]) || undefined;

  // Extract values
  const grossAmount = getNumber(["vNF", "ValorServicos", "valorTotal", "ValorLiquidoNfse"]) || 
                      getNumber(["vProd", "vTotTrib"]);
  
  // Extract emitter info
  const emitterName = getElementText(["xNome", "RazaoSocial", "razaoSocial"]);
  const emitterDoc = getElementText(["CNPJ", "CPF", "Cnpj", "cnpj"]);

  // Extract recipient info - look in dest element specifically
  const dest = xmlDoc.getElementsByTagName("dest")[0];
  let recipientName = "";
  let recipientDoc = "";
  if (dest) {
    recipientName = dest.getElementsByTagName("xNome")[0]?.textContent?.trim() || "";
    recipientDoc = dest.getElementsByTagName("CNPJ")[0]?.textContent?.trim() || 
                   dest.getElementsByTagName("CPF")[0]?.textContent?.trim() || "";
  }
  if (!recipientName) {
    recipientName = getElementText(["xNome", "RazaoSocial"]);
    recipientDoc = getElementText(["CNPJ", "CPF"]);
  }

  // Extract access key
  const infNFe = xmlDoc.getElementsByTagName("infNFe")[0];
  let accessKey = infNFe?.getAttribute("Id")?.replace("NFe", "") || "";
  if (!accessKey) {
    accessKey = getElementText(["chNFe", "ChaveNFe", "chaveAcesso"]);
  }

  // Extract items
  const items: ParsedNFe["items"] = [];
  const detElements = xmlDoc.getElementsByTagName("det");
  for (let i = 0; i < detElements.length; i++) {
    const det = detElements[i];
    const prod = det.getElementsByTagName("prod")[0];
    if (prod) {
      items.push({
        description: prod.getElementsByTagName("xProd")[0]?.textContent?.trim() || "",
        quantity: parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent || "1") || 1,
        unitValue: parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent || "0") || 0,
        totalValue: parseFloat(prod.getElementsByTagName("vProd")[0]?.textContent || "0") || 0,
      });
    }
  }

  // Extract taxes
  const ICMSTot = xmlDoc.getElementsByTagName("ICMSTot")[0];
  const taxes = ICMSTot ? {
    icms: parseFloat(ICMSTot.getElementsByTagName("vICMS")[0]?.textContent || "0") || 0,
    pis: parseFloat(ICMSTot.getElementsByTagName("vPIS")[0]?.textContent || "0") || 0,
    cofins: parseFloat(ICMSTot.getElementsByTagName("vCOFINS")[0]?.textContent || "0") || 0,
    ipi: parseFloat(ICMSTot.getElementsByTagName("vIPI")[0]?.textContent || "0") || 0,
  } : {};

  const taxAmount = Object.values(taxes).reduce((a, b) => a + b, 0);

  return {
    invoiceNumber,
    series,
    accessKey,
    issueDate,
    dueDate,
    grossAmount: grossAmount || items.reduce((acc, i) => acc + i.totalValue, 0),
    netAmount: grossAmount || items.reduce((acc, i) => acc + i.totalValue, 0),
    taxAmount,
    taxes,
    emitter: {
      name: emitterName,
      document: emitterDoc,
    },
    recipient: {
      name: recipientName,
      document: recipientDoc,
    },
    description: items.map(i => i.description).join(", ").substring(0, 500),
    items,
    invoiceType: "nfe",
  };
}

function parseNFeXMLContent(xmlDoc: Document): ParsedNFe {
  // NFe namespace handling
  const getElement = (parent: Element | Document, tagName: string): string => {
    const el = parent.getElementsByTagName(tagName)[0];
    return el?.textContent?.trim() || "";
  };

  const getNumber = (parent: Element | Document, tagName: string): number => {
    const value = getElement(parent, tagName);
    return parseFloat(value) || 0;
  };

  // Basic info
  const infNFe = xmlDoc.getElementsByTagName("infNFe")[0] || xmlDoc.documentElement;
  const ide = xmlDoc.getElementsByTagName("ide")[0];
  const emit = xmlDoc.getElementsByTagName("emit")[0];
  const dest = xmlDoc.getElementsByTagName("dest")[0];
  const total = xmlDoc.getElementsByTagName("total")[0];
  const ICMSTot = xmlDoc.getElementsByTagName("ICMSTot")[0];

  // Parse items
  const items: ParsedNFe["items"] = [];
  const detElements = xmlDoc.getElementsByTagName("det");
  for (let i = 0; i < detElements.length; i++) {
    const det = detElements[i];
    const prod = det.getElementsByTagName("prod")[0];
    if (prod) {
      items.push({
        description: getElement(prod, "xProd"),
        quantity: getNumber(prod, "qCom"),
        unitValue: getNumber(prod, "vUnCom"),
        totalValue: getNumber(prod, "vProd"),
      });
    }
  }

  // Extract access key from infNFe Id attribute
  const accessKey = infNFe?.getAttribute("Id")?.replace("NFe", "") || "";

  // Parse dates
  const dhEmi = getElement(ide, "dhEmi") || getElement(ide, "dEmi");
  const issueDate = dhEmi ? dhEmi.split("T")[0] : new Date().toISOString().split("T")[0];

  // Parse due date from billing
  const cobr = xmlDoc.getElementsByTagName("cobr")[0];
  const dup = cobr?.getElementsByTagName("dup")[0];
  const dueDate = dup ? getElement(dup, "dVenc") : undefined;

  return {
    invoiceNumber: getElement(ide, "nNF"),
    series: getElement(ide, "serie"),
    accessKey,
    issueDate,
    dueDate,
    grossAmount: getNumber(ICMSTot, "vNF"),
    netAmount: getNumber(ICMSTot, "vNF") - getNumber(ICMSTot, "vDesc"),
    taxAmount: getNumber(ICMSTot, "vTotTrib"),
    taxes: {
      icms: getNumber(ICMSTot, "vICMS"),
      pis: getNumber(ICMSTot, "vPIS"),
      cofins: getNumber(ICMSTot, "vCOFINS"),
      ipi: getNumber(ICMSTot, "vIPI"),
    },
    emitter: {
      name: getElement(emit, "xNome"),
      document: getElement(emit, "CNPJ") || getElement(emit, "CPF"),
      email: getElement(emit, "email"),
    },
    recipient: {
      name: getElement(dest, "xNome"),
      document: getElement(dest, "CNPJ") || getElement(dest, "CPF"),
      email: getElement(dest, "email"),
    },
    description: items.map(i => i.description).join(", ").substring(0, 500),
    items,
    invoiceType: "nfe",
  };
}

function parseNFSeXML(xmlDoc: Document): ParsedNFe {
  const getElement = (parent: Element | Document, tagName: string): string => {
    const el = parent.getElementsByTagName(tagName)[0];
    return el?.textContent?.trim() || "";
  };

  const getNumber = (parent: Element | Document, tagName: string): number => {
    const value = getElement(parent, tagName);
    return parseFloat(value) || 0;
  };

  // NFSe structure varies by city, try common patterns
  const infNfse = xmlDoc.getElementsByTagName("InfNfse")[0] || 
                  xmlDoc.getElementsByTagName("Nfse")[0] || 
                  xmlDoc.documentElement;

  const prestador = xmlDoc.getElementsByTagName("Prestador")[0] || 
                    xmlDoc.getElementsByTagName("IdentificacaoPrestador")[0];
  const tomador = xmlDoc.getElementsByTagName("Tomador")[0] ||
                  xmlDoc.getElementsByTagName("TomadorServico")[0];
  const servico = xmlDoc.getElementsByTagName("Servico")[0] ||
                  xmlDoc.getElementsByTagName("ListaServicos")[0];
  const valores = xmlDoc.getElementsByTagName("Valores")[0];

  const issueDate = getElement(infNfse, "DataEmissao") || 
                    getElement(infNfse, "dhEmi") ||
                    new Date().toISOString().split("T")[0];

  return {
    invoiceNumber: getElement(infNfse, "Numero") || getElement(infNfse, "NumeroNfse"),
    series: getElement(infNfse, "Serie") || "U",
    accessKey: getElement(infNfse, "CodigoVerificacao") || "",
    issueDate: issueDate.split("T")[0],
    dueDate: undefined,
    grossAmount: getNumber(valores, "ValorServicos") || getNumber(valores, "ValorLiquidoNfse"),
    netAmount: getNumber(valores, "ValorLiquidoNfse") || getNumber(valores, "ValorServicos"),
    taxAmount: getNumber(valores, "ValorIss") + getNumber(valores, "ValorPis") + getNumber(valores, "ValorCofins"),
    taxes: {
      iss: getNumber(valores, "ValorIss"),
      pis: getNumber(valores, "ValorPis"),
      cofins: getNumber(valores, "ValorCofins"),
      irrf: getNumber(valores, "ValorIr"),
      csll: getNumber(valores, "ValorCsll"),
    },
    emitter: {
      name: getElement(prestador, "RazaoSocial") || getElement(prestador, "Nome"),
      document: getElement(prestador, "Cnpj") || getElement(prestador, "CpfCnpj"),
      email: getElement(prestador, "Email"),
    },
    recipient: {
      name: getElement(tomador, "RazaoSocial") || getElement(tomador, "Nome"),
      document: getElement(tomador, "Cnpj") || getElement(tomador, "Cpf") || getElement(tomador, "CpfCnpj"),
      email: getElement(tomador, "Email"),
    },
    description: getElement(servico, "Discriminacao") || getElement(servico, "Descricao"),
    items: [{
      description: getElement(servico, "Discriminacao") || getElement(servico, "Descricao"),
      quantity: 1,
      unitValue: getNumber(valores, "ValorServicos"),
      totalValue: getNumber(valores, "ValorServicos"),
    }],
    invoiceType: "nfse",
  };
}

export function useImportInvoiceXML() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (parsedNFe: ParsedNFe) => {
      if (!currentWorkspace?.id) throw new Error("No workspace");

      const { data: userData } = await supabase.auth.getUser();

      // Check if invoice already exists
      const { data: existing } = await supabase
        .from("invoices")
        .select("id, transaction_id")
        .eq("workspace_id", currentWorkspace.id)
        .eq("invoice_number", parsedNFe.invoiceNumber)
        .eq("invoice_type", parsedNFe.invoiceType)
        .maybeSingle();

      if (existing) {
        throw new Error(`Nota fiscal ${parsedNFe.invoiceNumber} já cadastrada`);
      }

      // Determine transaction type based on who is emitter vs recipient
      // If we're the emitter (selling), it's income. If we're recipient (buying), it's expense.
      // Default to expense (we're receiving the invoice/buying)
      const transactionType: 'income' | 'expense' = 'expense';

      // Create the transaction first
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          workspace_id: currentWorkspace.id,
          type: transactionType,
          amount: parsedNFe.grossAmount,
          description: `NF ${parsedNFe.invoiceType.toUpperCase()} ${parsedNFe.invoiceNumber} - ${parsedNFe.description}`.substring(0, 500),
          due_date: parsedNFe.dueDate || parsedNFe.issueDate,
          status: "pending",
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Now create the invoice linked to the transaction
      const { data, error } = await supabase
        .from("invoices")
        .insert({
          workspace_id: currentWorkspace.id,
          invoice_number: parsedNFe.invoiceNumber,
          invoice_series: parsedNFe.series,
          invoice_type: parsedNFe.invoiceType,
          access_key: parsedNFe.accessKey,
          issue_date: parsedNFe.issueDate,
          due_date: parsedNFe.dueDate,
          gross_amount: parsedNFe.grossAmount,
          net_amount: parsedNFe.netAmount,
          tax_amount: parsedNFe.taxAmount,
          taxes: parsedNFe.taxes,
          recipient_name: parsedNFe.recipient.name,
          recipient_document: parsedNFe.recipient.document,
          recipient_email: parsedNFe.recipient.email,
          description: parsedNFe.description,
          status: "emitida",
          source: "xml_import",
          created_by: userData.user?.id,
          transaction_id: transaction.id,
          metadata: {
            emitter: parsedNFe.emitter,
            items: parsedNFe.items,
          },
        })
        .select()
        .single();

      if (error) {
        // Rollback transaction if invoice insert fails
        await supabase.from("transactions").delete().eq("id", transaction.id);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      toast.success("Nota fiscal importada com sucesso e lançamento criado");
    },
    onError: (error) => {
      toast.error("Erro ao importar nota fiscal", { description: error.message });
    },
  });
}

export function useXMLFileParser() {
  const [parsing, setParsing] = useState(false);
  const [parsedInvoices, setParsedInvoices] = useState<ParsedNFe[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const parseFiles = useCallback(async (files: FileList | File[]) => {
    setParsing(true);
    setErrors([]);
    const parsed: ParsedNFe[] = [];
    const parseErrors: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith(".xml")) {
        parseErrors.push(`${file.name}: Não é um arquivo XML`);
        continue;
      }

      try {
        const content = await file.text();
        const result = parseNFeXML(content);
        
        if (result) {
          parsed.push(result);
        } else {
          parseErrors.push(`${file.name}: Não foi possível parsear o XML`);
        }
      } catch (error) {
        parseErrors.push(`${file.name}: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
      }
    }

    setParsedInvoices(parsed);
    setErrors(parseErrors);
    setParsing(false);

    return { parsed, errors: parseErrors };
  }, []);

  const clearParsed = useCallback(() => {
    setParsedInvoices([]);
    setErrors([]);
  }, []);

  return {
    parsing,
    parsedInvoices,
    errors,
    parseFiles,
    clearParsed,
  };
}
