import unittest
from datetime import date
from generate_demo_data import generate


class DemoGeneratorTests(unittest.TestCase):
    def test_seed_is_reproducible_and_values_are_valid(self):
        first = generate(42, 6, "2026-11")
        self.assertEqual(first, generate(42, 6, "2026-11"))
        self.assertNotEqual(first, generate(43, 6, "2026-11"))
        self.assertEqual(len(first), 54)
        self.assertEqual(len({row["id"] for row in first}), 54)
        for row in first:
            self.assertGreater(row["amount_cents"], 0)
            self.assertIsInstance(row["amount_cents"], int)
            date.fromisoformat(row["date"])

    def test_crosses_year_boundary(self):
        rows = generate(1, 3, "2026-01")
        self.assertEqual({row["date"][:7] for row in rows}, {"2025-11", "2025-12", "2026-01"})


if __name__ == "__main__":
    unittest.main()
