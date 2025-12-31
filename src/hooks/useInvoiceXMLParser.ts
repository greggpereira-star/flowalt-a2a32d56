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
      throw new Error("XML inválido");
    }

    // Detect NFe vs NFSe
    const isNFSe = xmlDoc.querySelector("CompNfse, Nfse, InfNfse") !== null;
    const isNFe = xmlDoc.querySelector("NFe, infNFe, nfeProc") !== null;

    if (isNFSe) {
      return parseNFSeXML(xmlDoc);
    } else if (isNFe) {
      return parseNFeXMLContent(xmlDoc);
    }

    throw new Error("Formato de XML não reconhecido");
  } catch (error) {
    console.error("Error parsing XML:", error);
    return null;
  }
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
        .select("id")
        .eq("workspace_id", currentWorkspace.id)
        .eq("invoice_number", parsedNFe.invoiceNumber)
        .eq("invoice_type", parsedNFe.invoiceType)
        .maybeSingle();

      if (existing) {
        throw new Error(`Nota fiscal ${parsedNFe.invoiceNumber} já cadastrada`);
      }

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
          metadata: {
            emitter: parsedNFe.emitter,
            items: parsedNFe.items,
          },
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Nota fiscal importada com sucesso");
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
