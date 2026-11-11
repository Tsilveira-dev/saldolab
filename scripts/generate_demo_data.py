#!/usr/bin/env python3
"""Generate fictional, reproducible CSV data using only the Python standard library."""
import argparse
import calendar
import csv
import random
from datetime import date
from pathlib import Path


def generate(seed=42, months=6, end_month=None):
    rng = random.Random(seed)
    end = date.fromisoformat(f"{end_month}-01") if end_month else date.today().replace(day=1)
    rows = []
    for offset in range(months - 1, -1, -1):
        ordinal = end.year * 12 + end.month - 1 - offset
        year, month_index = divmod(ordinal, 12)
        month = month_index + 1
        last_day = calendar.monthrange(year, month)[1]
        entries = [
            ("Salário mensal", "income", "Salário", 840000, 2),
            ("Projeto freelance", "income", "Freelance", rng.randint(100000, 250000), 5),
            ("Aluguel do apartamento", "expense", "Moradia", 195000, 3),
            ("Supermercado", "expense", "Alimentação", rng.randint(30000, 60000), 4),
            ("Combustível", "expense", "Transporte", rng.randint(12000, 25000), 8),
            ("Plano de saúde", "expense", "Saúde", 42000, 7),
            ("Curso de desenvolvimento", "expense", "Educação", 18900, 10),
            ("Assinatura de streaming", "expense", "Assinaturas", 3990, 7),
            ("Cinema com amigos", "expense", "Lazer", rng.randint(6000, 15000), 11),
        ]
        for description, kind, category, amount, day in entries:
            rows.append({"id": f"demo-{len(rows)+1:04d}", "description": description,
                         "type": kind, "amount_cents": amount, "category": category,
                         "account": "Conta principal", "date": date(year, month, min(day, last_day)).isoformat(),
                         "status": "confirmed", "notes": "Dados fictícios"})
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--months", type=int, default=6)
    parser.add_argument("--end-month", help="Último mês no formato YYYY-MM")
    parser.add_argument("--output", type=Path, default=Path("work/demo-transactions.csv"))
    args = parser.parse_args()
    if not 1 <= args.months <= 120:
        parser.error("--months deve estar entre 1 e 120")
    try:
        rows = generate(args.seed, args.months, args.end_month)
    except ValueError:
        parser.error("--end-month deve ser um mês válido, por exemplo 2026-11")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), delimiter=";")
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} transações fictícias exportadas para {args.output}")


if __name__ == "__main__":
    main()
