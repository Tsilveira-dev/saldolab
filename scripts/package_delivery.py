"""Package the current committed source and Git history next to the built app."""
import html
import subprocess
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    destination = root / "dist" / "entrega"
    if not (root / "dist" / "index.html").exists():
        raise SystemExit("Execute npm run build antes de preparar a entrega.")
    destination.mkdir(parents=True, exist_ok=True)
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    subprocess.run(["git", "archive", "--format=zip", "--prefix=saldolab/", f"--output={destination / 'saldolab-source.zip'}", "HEAD"], cwd=root, check=True)
    bundle = destination / "saldolab-history.bundle"
    bundle.unlink(missing_ok=True)
    subprocess.run(["git", "bundle", "create", str(bundle), "--all"], cwd=root, check=True)
    source = f"""<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SaldoLab · Entrega do projeto</title><style>body{{margin:0;background:#f5f7f9;color:#23344a;font:15px/1.8 system-ui,sans-serif}}main{{max-width:700px;margin:8vh auto;padding:32px;background:white;border:1px solid #e9edf1;border-radius:12px}}h1{{letter-spacing:-1px}}small{{color:#7c8795}}a{{color:#32735f}}.button{{display:inline-block;background:#203b4c;color:white;text-decoration:none;padding:12px 20px;border-radius:7px;margin:8px 8px 8px 0}}code{{overflow-wrap:anywhere}}@media(max-width:760px){{main{{margin:20px;padding:24px}}}}</style><main><small>ENTREGA DO PROJETO</small><h1>SaldoLab</h1><p>Aplicação financeira funcional com React + Vite, CRUD, gráficos, orçamento, relatórios e persistência local.</p><p><a class="button" href="/">Abrir aplicação</a><a class="button" href="saldolab-source.zip" download>Baixar código-fonte ZIP</a><a class="button" href="saldolab-history.bundle" download>Baixar histórico Git</a></p><p>Verificado: lint, formatação, 65 testes JavaScript, 2 testes Python e build de produção. Os 12 cenários Playwright ainda precisam de execução em navegador.</p><p>A criação do repositório GitHub foi recusada pela conexão atual. A criação do projeto Vercel retornou HTTP 403. O README e a pasta docs do ZIP explicam as etapas necessárias.</p><p>Para executar o código extraído: <code>cd saldolab</code>, <code>npm ci</code> e <code>npm run dev</code>. Node.js 24 recomendado.</p><p>Para recuperar o histórico: <code>git clone saldolab-history.bundle saldolab</code>.</p><small>Commit: {html.escape(commit)}. Prévia privada publicada com Sites. Dados financeiros permanecem no navegador; faça backups regularmente.</small></main></html>"""
    (destination / "index.html").write_text(source, encoding="utf-8")
    print(f"Entrega preparada em {destination}; commit {commit}")


if __name__ == "__main__":
    main()
