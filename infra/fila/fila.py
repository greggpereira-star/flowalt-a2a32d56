#!/usr/bin/env python3
"""
Fila de pedidos do Banco de Ideias (análise de criativo e roteiros por cliente).

Quem usa: o agente de copy (Claude Code), via SSH. A equipe pede pelo Flowalt; este script lista o
que está pendente, marca como em andamento e grava o resultado. Não chama nenhuma API de IA.

Comandos:
  listar [--todos]                 pedidos pendentes (ou todos os abertos) com referência, transcrição e briefing, em JSON
  iniciar <pedido>                 pendente -> processando
  gravar-analise <pedido> <arq>    grava a análise (JSON) na referência e conclui o pedido de análise
  gravar-analise-ref <ref> <arq>   grava a análise direto na referência (usado antes de um pedido de roteiros)
  gravar-roteiros <pedido> <arq>   grava os roteiros (JSON) e conclui o pedido de roteiros
  erro <pedido> <mensagem>         marca o pedido com erro
  reabrir-travados [minutos]       processando há mais de N min (padrão 30) volta a pendente
"""
import json
import re
import secrets
import subprocess
import sys

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
UUID_EM_TEXTO = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def psql(sql: str) -> str:
    r = subprocess.run(
        ["docker", "exec", "-i", "supabase-db", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
        input=sql, text=True, capture_output=True, timeout=90,
    )
    if r.returncode != 0:
        sys.exit(f"Erro no banco: {r.stderr.strip()[:500]}")
    return r.stdout


def lit(valor) -> str:
    """Literal SQL seguro (dollar-quote com marcador aleatório que não aparece no conteúdo)."""
    texto = valor if isinstance(valor, str) else json.dumps(valor, ensure_ascii=False)
    while True:
        tag = "q" + secrets.token_hex(6)
        if f"${tag}$" not in texto:
            return f"${tag}${texto}${tag}$"


def uuid_ou_sair(v: str) -> str:
    if not UUID.match(v):
        sys.exit(f"Identificador inválido: {v}")
    return v


def ler_json(caminho: str):
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def _extrair(n) -> str:
    if not isinstance(n, dict):
        return ""
    if n.get("type") == "text":
        return n.get("text", "")
    filhos = [_extrair(c) for c in n.get("content", [])]
    t = n.get("type")
    if t == "doc":
        return re.sub(r"\n{3,}", "\n\n", "\n".join(filhos))
    if t == "bulletList":
        return "\n".join("- " + _extrair(li).strip() for li in n.get("content", []))
    if t == "orderedList":
        return "\n".join(f"{i + 1}. " + _extrair(li).strip() for i, li in enumerate(n.get("content", [])))
    if t == "listItem":
        return "\n".join(filhos)
    if t == "hardBreak":
        return "\n"
    return "".join(filhos)


def plano(v):
    """Campos do briefing podem vir como JSON do editor de texto formatado; vira texto puro."""
    if not isinstance(v, str):
        return v
    s = v.strip()
    if s.startswith("{") and '"type"' in s:
        try:
            d = json.loads(s)
            if isinstance(d, dict) and d.get("type") == "doc":
                return _extrair(d).strip() or None
        except ValueError:
            pass
    return s or None


def exigir(obj, chaves, onde):
    faltam = [k for k in chaves if k not in obj]
    if faltam:
        sys.exit(f"JSON inválido em {onde}: faltam {', '.join(faltam)}")


def validar_analise(a):
    exigir(a, ["resumo", "gancho", "estrutura", "gatilhos", "tom_e_ritmo", "por_que_funciona", "o_que_replicar", "o_que_evitar", "limitacoes"], "análise")
    exigir(a["gancho"], ["trecho", "tipo", "por_que_funciona"], "análise.gancho")
    exigir(a["tom_e_ritmo"], ["tom", "ritmo", "linguagem"], "análise.tom_e_ritmo")
    for i, e in enumerate(a["estrutura"]):
        exigir(e, ["etapa", "trecho", "funcao"], f"análise.estrutura[{i}]")
    for i, g in enumerate(a["gatilhos"]):
        exigir(g, ["nome", "evidencia"], f"análise.gatilhos[{i}]")


def validar_roteiros(d):
    exigir(d, ["roteiros", "lacunas_do_briefing"], "raiz")
    if not d["roteiros"]:
        sys.exit("Nenhum roteiro no arquivo")
    for i, r in enumerate(d["roteiros"]):
        exigir(r, ["titulo", "abordagem", "gancho", "cenas", "cta", "legenda", "hashtags", "por_que_funciona_para_o_cliente"], f"roteiros[{i}]")
        for j, c in enumerate(r["cenas"]):
            exigir(c, ["tempo", "fala", "visual"], f"roteiros[{i}].cenas[{j}]")


def pedido(id_: str):
    linhas = psql(f"select row_to_json(r) from idea_requests r where id = '{id_}';").strip()
    if not linhas:
        sys.exit("Pedido não encontrado")
    return json.loads(linhas)


def cmd_listar(todos: bool):
    estados = "'pendente','processando'" if todos else "'pendente'"
    sql = f"""
    select coalesce(json_agg(x order by x.created_at), '[]'::json) from (
      select r.id, r.kind, r.status, r.options, r.created_at, r.requested_by, p.full_name as solicitante,
        json_build_object('id', ref.id, 'titulo', ref.title, 'descricao', ref.description, 'plataforma', ref.platform,
          'autor', ref.author_name, 'tipo', ref.type, 'tags', ref.tags, 'transcricao', ref.transcript,
          'analise', ref.analysis) as referencia,
        case when r.client_id is null then null else json_build_object('id', c.id, 'nome', c.name, 'segmento', c.segment,
          'sobre', c.about_client, 'produtos_servicos', c.products_services, 'publico_alvo', c.target_audience,
          'objetivos', c.objectives, 'desafios', c.challenges, 'concorrentes', c.competitors,
          'posicionamento', c.positioning, 'personalidade', c.personality, 'essencia_da_marca', c.brand_essence,
          'tom_de_voz', c.relationship_tone, 'estilo_de_linguagem', c.language_style,
          'palavras_chave', c.keywords, 'restricoes_de_linguagem', c.language_restrictions) end as cliente
      from idea_requests r
      join idea_references ref on ref.id = r.reference_id
      left join client_cards c on c.id = r.client_id
      left join profiles p on p.id = r.requested_by
      where r.status in ({estados})
    ) x;"""
    pedidos = json.loads(psql(sql).strip())
    for p in pedidos:
        if p.get("cliente"):
            p["cliente"] = {k: plano(v) for k, v in p["cliente"].items()}
    print(json.dumps(pedidos, ensure_ascii=False))


def cmd_iniciar(id_: str):
    uuid_ou_sair(id_)
    out = psql(f"update idea_requests set status='processando', started_at=now() where id='{id_}' and status='pendente' returning id;")
    if id_ not in UUID_EM_TEXTO.findall(out):
        sys.exit("Pedido não está pendente (já iniciado, concluído ou inexistente)")
    print("iniciado")


def cmd_gravar_analise_ref(ref_id: str, arq: str):
    uuid_ou_sair(ref_id)
    a = ler_json(arq)
    validar_analise(a)
    psql(f"""update idea_references set analysis = {lit(a)}::jsonb, analysis_at = now(),
             review_status = case when review_status = 'para_analisar' then 'analisado' else review_status end
             where id = '{ref_id}';""")
    print("análise gravada na referência")


def cmd_gravar_analise(id_: str, arq: str):
    uuid_ou_sair(id_)
    p = pedido(id_)
    if p["kind"] != "analise":
        sys.exit("Este pedido não é de análise")
    if p["status"] != "processando":
        sys.exit(f"Pedido está '{p['status']}', esperado 'processando' (use iniciar antes)")
    cmd_gravar_analise_ref(p["reference_id"], arq)
    psql(f"update idea_requests set status='pronto', finished_at=now(), error=null where id='{id_}';")
    print("pedido concluído")


def cmd_gravar_roteiros(id_: str, arq: str):
    uuid_ou_sair(id_)
    p = pedido(id_)
    if p["kind"] != "roteiros":
        sys.exit("Este pedido não é de roteiros")
    if p["status"] != "processando":
        sys.exit(f"Pedido está '{p['status']}', esperado 'processando' (use iniciar antes)")
    d = ler_json(arq)
    validar_roteiros(d)
    ws = p["workspace_id"]
    ops = p.get("options") or {}
    linhas = []
    for r in d["roteiros"]:
        linhas.append(
            f"('{ws}', '{p['reference_id']}', '{p['client_id']}', {lit(str(r['titulo'])[:200])}, {lit(r)}::jsonb, {lit(ops)}::jsonb, '{p['requested_by']}')"
        )
    psql(f"""begin;
      insert into idea_scripts (workspace_id, reference_id, client_id, title, content, options, created_by) values {", ".join(linhas)};
      update idea_requests set status='pronto', finished_at=now(), error=null,
        result = {lit({"lacunas_do_briefing": d["lacunas_do_briefing"]})}::jsonb where id='{id_}';
      commit;""")
    print(f"{len(linhas)} roteiro(s) gravado(s); pedido concluído")


def cmd_erro(id_: str, msg: str):
    uuid_ou_sair(id_)
    psql(f"update idea_requests set status='erro', finished_at=now(), error={lit(msg[:400])} where id='{id_}';")
    print("pedido marcado com erro")


def cmd_reabrir(minutos: int):
    out = psql(f"""update idea_requests set status='pendente', started_at=null
                   where status='processando' and started_at < now() - interval '{int(minutos)} minutes' returning id;""")
    print(f"{len(UUID_EM_TEXTO.findall(out))} pedido(s) reaberto(s)")


def main():
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"):
        print(__doc__)
        return
    c = a[0]
    if c == "listar":
        cmd_listar("--todos" in a)
    elif c == "iniciar" and len(a) == 2:
        cmd_iniciar(a[1])
    elif c == "gravar-analise" and len(a) == 3:
        cmd_gravar_analise(a[1], a[2])
    elif c == "gravar-analise-ref" and len(a) == 3:
        cmd_gravar_analise_ref(a[1], a[2])
    elif c == "gravar-roteiros" and len(a) == 3:
        cmd_gravar_roteiros(a[1], a[2])
    elif c == "erro" and len(a) >= 3:
        cmd_erro(a[1], " ".join(a[2:]))
    elif c == "reabrir-travados":
        cmd_reabrir(int(a[1]) if len(a) > 1 else 30)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
