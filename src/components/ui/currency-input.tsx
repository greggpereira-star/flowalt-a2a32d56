import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string | number;
  onChange?: (value: string) => void;
}

function formatToCurrency(value: string): string {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, "");
  
  if (!numbers) return "";
  
  // Converte para centavos e depois para reais
  const cents = parseInt(numbers, 10);
  const reais = cents / 100;
  
  // Formata para o padrão brasileiro
  return reais.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyToNumber(value: string): number {
  if (!value) return 0;
  // Remove pontos de milhar e converte vírgula para ponto
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

export function formatCurrencyFromNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, placeholder = "0,00", ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Sincroniza o valor externo com o display
    React.useEffect(() => {
      if (value !== undefined && value !== null && value !== "") {
        // Se for número, formata
        if (typeof value === "number") {
          setDisplayValue(formatCurrencyFromNumber(value));
        } else {
          // Se for string, verifica se já está formatada ou precisa converter
          const numericValue = parseCurrencyToNumber(value);
          if (numericValue > 0) {
            setDisplayValue(formatCurrencyFromNumber(numericValue));
          } else {
            setDisplayValue("");
          }
        }
      } else {
        setDisplayValue("");
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const formatted = formatToCurrency(inputValue);
      setDisplayValue(formatted);
      onChange?.(formatted);
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          R$
        </span>
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          className={cn("pl-9", className)}
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          {...props}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput, parseCurrencyToNumber };
