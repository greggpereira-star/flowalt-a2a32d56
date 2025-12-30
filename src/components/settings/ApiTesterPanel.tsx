import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Play, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  RotateCcw,
  Send,
  Code2
} from 'lucide-react';
import { toast } from 'sonner';

interface TestResult {
  id: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  response: string;
  timestamp: Date;
  success: boolean;
}

const ENDPOINT_PRESETS = [
  { method: 'GET', path: '/status', label: 'Health Check' },
  { method: 'GET', path: '/cards', label: 'Listar Cards' },
  { method: 'GET', path: '/transactions', label: 'Listar Transações' },
  { method: 'GET', path: '/clients', label: 'Listar Clientes' },
  { method: 'GET', path: '/events', label: 'Listar Eventos' },
  { method: 'GET', path: '/openapi', label: 'OpenAPI Spec' },
];

export function ApiTesterPanel() {
  const [apiKey, setApiKey] = useState('');
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/status');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const apiBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api`;

  const executeRequest = async () => {
    if (!path) {
      toast.error('Informe o path da requisição');
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }

      const options: RequestInit = {
        method,
        headers,
      };

      if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
        options.body = body;
      }

      const response = await fetch(`${apiBaseUrl}${path}`, options);
      const duration = Date.now() - startTime;
      
      let responseText: string;
      try {
        const json = await response.json();
        responseText = JSON.stringify(json, null, 2);
      } catch {
        responseText = await response.text();
      }

      const result: TestResult = {
        id: crypto.randomUUID(),
        method,
        path,
        status: response.status,
        duration,
        response: responseText,
        timestamp: new Date(),
        success: response.ok,
      };

      setResults(prev => [result, ...prev].slice(0, 20));
      
      if (response.ok) {
        toast.success(`${response.status} - ${duration}ms`);
      } else {
        toast.error(`Erro ${response.status}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: TestResult = {
        id: crypto.randomUUID(),
        method,
        path,
        status: 0,
        duration,
        response: error instanceof Error ? error.message : 'Network error',
        timestamp: new Date(),
        success: false,
      };
      setResults(prev => [result, ...prev].slice(0, 20));
      toast.error('Erro de conexão');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreset = (preset: typeof ENDPOINT_PRESETS[0]) => {
    setMethod(preset.method);
    setPath(preset.path);
    setBody('');
  };

  const copyResponse = (response: string) => {
    navigator.clipboard.writeText(response);
    toast.success('Resposta copiada');
  };

  const clearHistory = () => {
    setResults([]);
    toast.success('Histórico limpo');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2 className="h-5 w-5" />
          API Tester
        </CardTitle>
        <CardDescription>
          Teste endpoints da API diretamente do navegador
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* API Key */}
        <div className="space-y-2">
          <Label>API Key (opcional para /status)</Label>
          <Input
            type="password"
            placeholder="lv_sua_api_key_aqui"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <Label>Presets Rápidos</Label>
          <div className="flex flex-wrap gap-2">
            {ENDPOINT_PRESETS.map((preset, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => loadPreset(preset)}
              >
                <Badge variant="secondary" className="mr-2 text-xs">
                  {preset.method}
                </Badge>
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Request Builder */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-2">
            <Label>Método</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-8">
            <Label>Path</Label>
            <Input
              placeholder="/cards"
              value={path}
              onChange={(e) => setPath(e.target.value)}
            />
          </div>
          <div className="col-span-2 flex items-end">
            <Button 
              className="w-full" 
              onClick={executeRequest}
              disabled={isLoading}
            >
              {isLoading ? (
                <RotateCcw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Request Body */}
        {['POST', 'PUT', 'PATCH'].includes(method) && (
          <div className="space-y-2">
            <Label>Body (JSON)</Label>
            <Textarea
              placeholder='{"title": "Novo card", "space_id": "uuid..."}'
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="font-mono text-sm min-h-[100px]"
            />
          </div>
        )}

        {/* Results */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Histórico de Requisições</Label>
            {results.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearHistory}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          <ScrollArea className="h-[400px] border rounded-lg">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Play className="h-8 w-8 mb-2 opacity-50" />
                <p>Execute uma requisição para ver os resultados</p>
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className={`border rounded-lg overflow-hidden ${
                      result.success ? 'border-green-500/30' : 'border-red-500/30'
                    }`}
                  >
                    <div className={`px-3 py-2 flex items-center justify-between ${
                      result.success ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}>
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <Badge variant="outline">{result.method}</Badge>
                        <code className="text-sm">{result.path}</code>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Badge variant={result.success ? 'default' : 'destructive'}>
                          {result.status || 'ERR'}
                        </Badge>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {result.duration}ms
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyResponse(result.response)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <pre className="p-3 bg-muted/30 text-xs overflow-x-auto max-h-[200px] overflow-y-auto">
                      {result.response}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
