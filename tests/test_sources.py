import unittest

from rochelle_agent.sources import extract_salary


class SourceTests(unittest.TestCase):
    def test_extracts_annual_range(self):
        self.assertEqual(extract_salary("Base salary $110,000 - $135,000 plus bonus"), (110000, 135000))

    def test_does_not_convert_hourly_rate(self):
        self.assertEqual(extract_salary("Pay is $55 per hour"), (None, None))


if __name__ == "__main__":
    unittest.main()
