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

    // Detection (namespace-safe). Many NFSe XMLs use prefixes, so we must match by localName.
    const rootLocalName = xmlDoc.documentElement?.localName || xmlDoc.documentElement?.tagName || "";
    const rootNs =
      xmlDoc.documentElement?.namespaceURI ||
      xmlDoc.documentElement?.getAttribute("xmlns") ||
      "";

    const getAllByLocalName = (tagName: string): Element[] => {
      const byTag = Array.from(xmlDoc.getElementsByTagName(tagName) as unknown as Iterable<Element>);
      if (byTag.length > 0) return byTag;

      const all = Array.from(xmlDoc.getElementsByTagName("*") as unknown as Iterable<Element>);
      return all.filter((el) => (el as any).localName === tagName);
    };

    const hasAny = (tags: string[]) => tags.some((t) => getAllByLocalName(t).length > 0);

    const isNFSeRoot = /nfse/i.test(rootLocalName) || /nfse/i.test(rootNs);

    const hasNFeElements =
      hasAny(["infNFe", "NFe", "nfeProc", "ide", "emit", "dest"]) ||
      xmlDoc.querySelector("[Id*='NFe']") !== null ||
      /nfeproc/i.test(rootLocalName);

    const hasNFSeElements =
      hasAny([
        "NFSe",
        "Nfse",
        "CompNfse",
        "InfNfse",
        "ListaNfse",
        "ConsultarNfseResposta",
        "Prestador",
        "Tomador",
        "TomadorServico",
        "InfDeclaracaoPrestacaoServico",
        "DeclaracaoPrestacaoServico",
        "Rps",
      ]);

    console.log("Has NFe elements:", hasNFeElements, "Has NFSe elements:", hasNFSeElements, "Root:", rootLocalName);

    if (isNFSeRoot || (hasNFSeElements && !hasNFeElements)) {
      return parseNFSeXML(xmlDoc);
    }

    if (hasNFeElements) {
      return parseNFeXMLContent(xmlDoc);
    }

    // If we still can't detect, try fallbacks.
    console.log("Could not detect XML type, attempting fallback parses...");

    const nfeResult = tryParseAsNFe(xmlDoc);
    if (nfeResult) return nfeResult;

    // Last attempt: NFSe parser (may still succeed even if detection failed)
    try {
      return parseNFSeXML(xmlDoc);
    } catch {
      // ignore and throw below
    }

    throw new Error("Formato de XML não reconhecido. Verifique se é um XML de NF-e ou NFS-e válido.");
  } catch (error) {
    console.error("Error parsing XML:", error);
    throw error;
  }
}

// Fallback NFe parser that tries to extract data even from non-standard formats
function tryParseAsNFe(xmlDoc: Document): ParsedNFe | null {
  const getAll = (tagName: string): Element[] => {
    const byTag = Array.from(xmlDoc.getElementsByTagName(tagName) as unknown as Iterable<Element>);
    if (byTag.length > 0) return byTag;

    // Namespace-safe: match by localName
    const all = Array.from(xmlDoc.getElementsByTagName("*") as unknown as Iterable<Element>);
    return all.filter((el) => (el as any).localName === tagName);
  };

  const getFirst = (tagName: string): Element | null => getAll(tagName)[0] ?? null;

  const getElementText = (tagNames: string[]): string => {
    for (const tagName of tagNames) {
      const el = getFirst(tagName);
      if (el?.textContent) return el.textContent.trim();
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
  const grossAmount =
    getNumber(["vNF", "ValorServicos", "valorTotal", "ValorLiquidoNfse"]) ||
    getNumber(["vProd", "vTotTrib"]);

  // Extract emitter info
  const emitterName = getElementText(["xNome", "RazaoSocial", "razaoSocial"]);
  const emitterDoc = getElementText(["CNPJ", "CPF", "Cnpj", "cnpj"]);

  // Extract recipient info - try dest first
  const dest = getFirst("dest");
  let recipientName = "";
  let recipientDoc = "";

  const getChildText = (parent: Element, tagName: string): string => {
    const byTag = parent.getElementsByTagName(tagName);
    if (byTag.length > 0 && byTag[0].textContent) return byTag[0].textContent.trim();

    const all = Array.from(parent.getElementsByTagName("*") as unknown as Iterable<Element>);
    const byLocal = all.find((el) => (el as any).localName === tagName);
    return byLocal?.textContent?.trim() || "";
  };

  if (dest) {
    recipientName = getChildText(dest, "xNome") || getChildText(dest, "RazaoSocial") || "";
    recipientDoc =
      getChildText(dest, "CNPJ") ||
      getChildText(dest, "CPF") ||
      getChildText(dest, "Cnpj") ||
      getChildText(dest, "Cpf") ||
      "";
  }

  if (!recipientName) {
    recipientName = getElementText(["xNome", "RazaoSocial"]);
    recipientDoc = getElementText(["CNPJ", "CPF"]);
  }

  // Extract access key
  const infNFe = getFirst("infNFe");
  let accessKey = (infNFe as Element | null)?.getAttribute?.("Id")?.replace("NFe", "") || "";
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
  type DomParent = Document | Element | null | undefined;

  const getAll = (parent: DomParent, tagName: string): Element[] => {
    if (!parent) return [];

    const byTag = Array.from(parent.getElementsByTagName(tagName) as unknown as Iterable<Element>);
    if (byTag.length > 0) return byTag;

    // Fallback for XMLs that use namespaces/prefixes: match by localName
    const all = Array.from(parent.getElementsByTagName("*") as unknown as Iterable<Element>);
    return all.filter((el) => (el as any).localName === tagName);
  };

  const getFirst = (parent: DomParent, tagName: string): Element | null => getAll(parent, tagName)[0] ?? null;

  const getText = (parent: DomParent, tagName: string): string => {
    const el = getFirst(parent, tagName);
    return el?.textContent?.trim() || "";
  };

  const getNumber = (parent: DomParent, tagName: string): number => {
    const value = getText(parent, tagName);
    return parseFloat(value) || 0;
  };

  const infNFe = getFirst(xmlDoc, "infNFe") ?? xmlDoc.documentElement;
  const ide = getFirst(xmlDoc, "ide");
  const emit = getFirst(xmlDoc, "emit");
  const dest = getFirst(xmlDoc, "dest");
  const ICMSTot = getFirst(xmlDoc, "ICMSTot");

  // Items
  const items: ParsedNFe["items"] = [];
  const detElements = getAll(xmlDoc, "det");
  for (const det of detElements) {
    const prod = getFirst(det, "prod");
    if (!prod) continue;

    items.push({
      description: getText(prod, "xProd"),
      quantity: getNumber(prod, "qCom"),
      unitValue: getNumber(prod, "vUnCom"),
      totalValue: getNumber(prod, "vProd"),
    });
  }

  // Access key
  const accessKey =
    (infNFe as Element)?.getAttribute?.("Id")?.replace("NFe", "") ||
    getText(xmlDoc, "chNFe") ||
    getText(xmlDoc, "ChaveNFe") ||
    "";

  // Dates
  const dhEmi = getText(ide, "dhEmi") || getText(ide, "dEmi") || getText(xmlDoc, "dhEmi") || getText(xmlDoc, "dEmi");
  const issueDate = dhEmi ? dhEmi.split("T")[0] : new Date().toISOString().split("T")[0];

  const cobr = getFirst(xmlDoc, "cobr");
  const dup = getFirst(cobr, "dup");
  const dueDate = dup ? (getText(dup, "dVenc") || undefined) : undefined;

  // Core identifiers
  const invoiceNumber = getText(ide, "nNF") || getText(xmlDoc, "nNF");
  const series = getText(ide, "serie") || getText(xmlDoc, "serie") || "1";

  if (!invoiceNumber) {
    // Try the fallback parser before giving up
    const fallback = tryParseAsNFe(xmlDoc);
    if (fallback) return fallback;
    throw new Error("XML de NF-e inválido: não encontrei o número da nota (nNF).");
  }

  // Values
  const itemsTotal = items.reduce((acc, i) => acc + (Number(i.totalValue) || 0), 0);

  const vNF = getNumber(ICMSTot, "vNF") || itemsTotal;
  const vDesc = getNumber(ICMSTot, "vDesc");
  const vTotTrib = getNumber(ICMSTot, "vTotTrib");

  const taxes = {
    icms: getNumber(ICMSTot, "vICMS") || undefined,
    pis: getNumber(ICMSTot, "vPIS") || undefined,
    cofins: getNumber(ICMSTot, "vCOFINS") || undefined,
    ipi: getNumber(ICMSTot, "vIPI") || undefined,
  };

  return {
    invoiceNumber,
    series,
    accessKey,
    issueDate,
    dueDate,
    grossAmount: vNF,
    netAmount: vNF - vDesc,
    taxAmount: vTotTrib || Object.values(taxes).reduce((acc, v) => acc + (v || 0), 0),
    taxes,
    emitter: {
      name: getText(emit, "xNome"),
      document: getText(emit, "CNPJ") || getText(emit, "CPF"),
      email: getText(emit, "email"),
    },
    recipient: {
      name: getText(dest, "xNome"),
      document: getText(dest, "CNPJ") || getText(dest, "CPF"),
      email: getText(dest, "email"),
    },
    description: (items.map((i) => i.description).join(", ") || "NF-e").substring(0, 500),
    items,
    invoiceType: "nfe",
  };
}

function parseNFSeXML(xmlDoc: Document): ParsedNFe {
  type DomParent = Document | Element | null | undefined;

  const getAll = (parent: DomParent, tagName: string): Element[] => {
    if (!parent) return [];

    const byTag = Array.from(parent.getElementsByTagName(tagName) as unknown as Iterable<Element>);
    if (byTag.length > 0) return byTag;

    // Namespace-safe: match by localName
    const all = Array.from(parent.getElementsByTagName("*") as unknown as Iterable<Element>);
    return all.filter((el) => (el as any).localName === tagName);
  };

  const getFirst = (parent: DomParent, tagName: string): Element | null => getAll(parent, tagName)[0] ?? null;

  const getFirstAny = (parent: DomParent, tagNames: string[]): Element | null => {
    for (const tag of tagNames) {
      const el = getFirst(parent, tag);
      if (el) return el;
    }
    return null;
  };

  const getText = (parent: DomParent, tagName: string): string => getFirst(parent, tagName)?.textContent?.trim() || "";

  const getTextAny = (parent: DomParent, tagNames: string[]): string => {
    for (const tag of tagNames) {
      const v = getText(parent, tag);
      if (v) return v;
    }
    return "";
  };

  const getNumberAny = (parent: DomParent, tagNames: string[]): number => {
    const raw = getTextAny(parent, tagNames);
    return parseFloat(raw) || 0;
  };

  // NFSe structure varies by city/provider
  const infNfse = getFirstAny(xmlDoc, ["InfNfse", "Nfse", "NFSe", "infNfse"]) ?? xmlDoc.documentElement;
  const prestador = getFirstAny(xmlDoc, ["Prestador", "IdentificacaoPrestador", "PrestadorServico"]);
  const tomador = getFirstAny(xmlDoc, ["Tomador", "TomadorServico", "IdentificacaoTomador"]);
  const servico = getFirstAny(xmlDoc, ["Servico", "ListaServicos", "DadosServico"]);
  const valores =
    getFirstAny(servico, ["Valores", "ValoresServico", "ValoresNfse"]) ??
    getFirstAny(xmlDoc, ["Valores", "ValoresServico", "ValoresNfse"]);

  const issueRaw =
    getTextAny(infNfse, ["DataEmissao", "dhEmi", "dataEmissao", "Competencia"]) ||
    getTextAny(xmlDoc, ["DataEmissao", "dhEmi", "Competencia"]);
  const issueDate = (issueRaw || new Date().toISOString()).split("T")[0];

  const invoiceNumber =
    getTextAny(infNfse, ["Numero", "NumeroNfse", "numNfse", "numero"]) ||
    getTextAny(xmlDoc, ["Numero", "NumeroNfse", "numNfse", "numero"]);

  if (!invoiceNumber) {
    throw new Error("XML de NFS-e inválido: não encontrei o número da nota (Numero).");
  }

  const series = getTextAny(infNfse, ["Serie", "serie"]) || "U";
  const accessKey = getTextAny(infNfse, ["CodigoVerificacao", "codigoVerificacao", "CodigoVerificacaoNfse"]) || "";

  const description = getTextAny(servico, ["Discriminacao", "Descricao", "descricao"]) || "NFS-e";

  const grossAmount =
    getNumberAny(valores, ["ValorServicos", "ValorBruto", "ValorServicosNfse"]) ||
    getNumberAny(infNfse, ["ValorServicos"]) ||
    getNumberAny(xmlDoc, ["ValorServicos"]);

  const netAmount =
    getNumberAny(valores, ["ValorLiquidoNfse", "ValorLiquido", "ValorServicos"]) ||
    getNumberAny(infNfse, ["ValorLiquidoNfse"]) ||
    grossAmount;

  const iss = getNumberAny(valores, ["ValorIss", "ValorIssqn", "ValorISS"]);
  const pis = getNumberAny(valores, ["ValorPis", "ValorPIS"]);
  const cofins = getNumberAny(valores, ["ValorCofins", "ValorCOFINS"]);
  const irrf = getNumberAny(valores, ["ValorIr", "ValorIRRF", "ValorIrrf"]);
  const csll = getNumberAny(valores, ["ValorCsll", "ValorCSLL"]);

  const taxAmount = iss + pis + cofins + irrf + csll;

  return {
    invoiceNumber,
    series,
    accessKey,
    issueDate,
    dueDate: undefined,
    grossAmount: grossAmount || netAmount,
    netAmount: netAmount || grossAmount,
    taxAmount,
    taxes: {
      iss: iss || undefined,
      pis: pis || undefined,
      cofins: cofins || undefined,
      irrf: irrf || undefined,
      csll: csll || undefined,
    },
    emitter: {
      name: getTextAny(prestador, ["RazaoSocial", "Nome", "xNome"]),
      document: getTextAny(prestador, ["Cnpj", "CNPJ", "CpfCnpj", "Cpf", "CPF"]),
      email: getTextAny(prestador, ["Email", "email"]),
    },
    recipient: {
      name: getTextAny(tomador, ["RazaoSocial", "Nome", "xNome"]),
      document: getTextAny(tomador, ["Cnpj", "CNPJ", "Cpf", "CPF", "CpfCnpj"]),
      email: getTextAny(tomador, ["Email", "email"]),
    },
    description: description.substring(0, 500),
    items: [
      {
        description: description.substring(0, 500),
        quantity: 1,
        unitValue: netAmount || grossAmount,
        totalValue: netAmount || grossAmount,
      },
    ],
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
