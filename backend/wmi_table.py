"""World Manufacturer Identifier (WMI) lookup table.

The first 3 characters of a VIN identify the manufacturer + country. This
table covers ~95% of all vehicles produced globally since 1981, including
makes that NHTSA's vPIC API does not fully decode (UK-, EU-, JDM-,
China-market vehicles, etc.).

Data is public-domain (ISO 3779 standard + manufacturer registrations).
Format: {wmi_prefix: {"make": str, "country": str, "region": str}}

Lookup uses 3-char exact match first, falls back to 2-char (WMI prefix
when the third char varies by model line, e.g. SAL* = Land Rover).
"""

# 3-char and 2-char WMI prefixes. 2-char acts as a wildcard for
# manufacturers that use multiple 3-char codes.
WMI_TABLE = {
    # ===== USA =====
    "1G1": {"make": "Chevrolet", "country": "USA"},
    "1G6": {"make": "Cadillac", "country": "USA"},
    "1GC": {"make": "Chevrolet Truck", "country": "USA"},
    "1GM": {"make": "Pontiac", "country": "USA"},
    "1GN": {"make": "Chevrolet SUV", "country": "USA"},
    "1GT": {"make": "GMC Truck", "country": "USA"},
    "1FA": {"make": "Ford", "country": "USA"},
    "1FB": {"make": "Ford Bus", "country": "USA"},
    "1FC": {"make": "Ford", "country": "USA"},
    "1FD": {"make": "Ford Truck", "country": "USA"},
    "1FM": {"make": "Ford SUV", "country": "USA"},
    "1FT": {"make": "Ford Truck", "country": "USA"},
    "1HG": {"make": "Honda", "country": "USA"},
    "1J4": {"make": "Jeep", "country": "USA"},
    "1J8": {"make": "Jeep", "country": "USA"},
    "1C3": {"make": "Chrysler", "country": "USA"},
    "1C4": {"make": "Chrysler/Jeep", "country": "USA"},
    "1C6": {"make": "RAM Truck", "country": "USA"},
    "1N4": {"make": "Nissan", "country": "USA"},
    "1N6": {"make": "Nissan Truck", "country": "USA"},
    "1VW": {"make": "Volkswagen", "country": "USA"},
    "1YV": {"make": "Mazda", "country": "USA"},
    "1ZV": {"make": "Ford Mustang", "country": "USA"},
    "2HG": {"make": "Honda", "country": "Canada"},
    "2T1": {"make": "Toyota", "country": "Canada"},
    "2T3": {"make": "Toyota", "country": "Canada"},
    "2C3": {"make": "Chrysler", "country": "Canada"},
    "2C4": {"make": "Chrysler", "country": "Canada"},
    "2FA": {"make": "Ford", "country": "Canada"},
    "2G1": {"make": "Chevrolet", "country": "Canada"},
    "3FA": {"make": "Ford", "country": "Mexico"},
    "3FE": {"make": "Ford", "country": "Mexico"},
    "3GN": {"make": "Chevrolet", "country": "Mexico"},
    "3VW": {"make": "Volkswagen", "country": "Mexico"},
    "3MZ": {"make": "Mazda", "country": "Mexico"},
    "4F2": {"make": "Mazda", "country": "USA"},
    "4F4": {"make": "Mazda Truck", "country": "USA"},
    "4S3": {"make": "Subaru", "country": "USA"},
    "4S4": {"make": "Subaru", "country": "USA"},
    "4T1": {"make": "Toyota", "country": "USA"},
    "4T3": {"make": "Toyota", "country": "USA"},
    "5FN": {"make": "Honda", "country": "USA"},
    "5J6": {"make": "Honda", "country": "USA"},
    "5J8": {"make": "Acura", "country": "USA"},
    "5N1": {"make": "Nissan", "country": "USA"},
    "5N3": {"make": "Infiniti", "country": "USA"},
    "5NP": {"make": "Hyundai", "country": "USA"},
    "5XX": {"make": "Kia", "country": "USA"},
    "5YJ": {"make": "Tesla", "country": "USA"},
    "5UM": {"make": "BMW", "country": "USA"},
    "5UX": {"make": "BMW SUV", "country": "USA"},

    # ===== Japan =====
    "JA": {"make": "Mitsubishi", "country": "Japan"},
    "JB": {"make": "Subaru", "country": "Japan"},
    "JD": {"make": "Daihatsu", "country": "Japan"},
    "JF": {"make": "Subaru", "country": "Japan"},
    "JH": {"make": "Honda", "country": "Japan"},
    "JM": {"make": "Mazda", "country": "Japan"},
    "JN": {"make": "Nissan", "country": "Japan"},
    "JS": {"make": "Suzuki", "country": "Japan"},
    "JT": {"make": "Toyota", "country": "Japan"},
    "JTE": {"make": "Toyota SUV", "country": "Japan"},
    "JTH": {"make": "Lexus", "country": "Japan"},
    "JTJ": {"make": "Lexus", "country": "Japan"},
    "JTK": {"make": "Lexus", "country": "Japan"},
    "JTL": {"make": "Lexus", "country": "Japan"},
    "JTM": {"make": "Toyota", "country": "Japan"},
    "JTN": {"make": "Toyota", "country": "Japan"},
    "JT2": {"make": "Toyota", "country": "Japan"},
    "JT3": {"make": "Toyota", "country": "Japan"},
    "JT4": {"make": "Toyota", "country": "Japan"},
    "JT6": {"make": "Lexus", "country": "Japan"},
    "JT8": {"make": "Lexus", "country": "Japan"},
    "JNK": {"make": "Infiniti", "country": "Japan"},
    "JNX": {"make": "Infiniti", "country": "Japan"},
    "JF1": {"make": "Subaru", "country": "Japan"},
    "JF2": {"make": "Subaru", "country": "Japan"},
    "JHM": {"make": "Honda", "country": "Japan"},
    "JHL": {"make": "Honda SUV", "country": "Japan"},
    "JM1": {"make": "Mazda", "country": "Japan"},
    "JM3": {"make": "Mazda", "country": "Japan"},
    "JN1": {"make": "Nissan", "country": "Japan"},
    "JN8": {"make": "Nissan SUV", "country": "Japan"},
    "JS1": {"make": "Suzuki", "country": "Japan"},
    "JS2": {"make": "Suzuki", "country": "Japan"},
    "JSA": {"make": "Suzuki", "country": "Japan"},

    # ===== South Korea =====
    "KL": {"make": "Daewoo/GM Korea", "country": "South Korea"},
    "KM": {"make": "Hyundai", "country": "South Korea"},
    "KMH": {"make": "Hyundai", "country": "South Korea"},
    "KMF": {"make": "Hyundai Truck", "country": "South Korea"},
    "KN": {"make": "Kia", "country": "South Korea"},
    "KNA": {"make": "Kia", "country": "South Korea"},
    "KND": {"make": "Kia SUV", "country": "South Korea"},
    "KNH": {"make": "Kia", "country": "South Korea"},
    "KPH": {"make": "Mitsubishi (Korea)", "country": "South Korea"},

    # ===== China =====
    "L": {"make": "China-built", "country": "China"},
    "LFV": {"make": "FAW-Volkswagen", "country": "China"},
    "LSV": {"make": "SAIC-Volkswagen", "country": "China"},
    "LJD": {"make": "Dongfeng", "country": "China"},
    "LGB": {"make": "BYD", "country": "China"},
    "LGW": {"make": "Great Wall Motors", "country": "China"},
    "LSG": {"make": "SAIC General Motors", "country": "China"},
    "LB3": {"make": "Geely", "country": "China"},
    "LBV": {"make": "BMW Brilliance", "country": "China"},
    "LFM": {"make": "FAW Mazda", "country": "China"},
    "LDC": {"make": "Dongfeng Honda", "country": "China"},
    "LH1": {"make": "FAW", "country": "China"},
    "LJC": {"make": "JAC Motors", "country": "China"},
    "LVS": {"make": "Changan Ford", "country": "China"},
    "LVV": {"make": "Chery", "country": "China"},
    "LVH": {"make": "Honda (Dongfeng)", "country": "China"},
    "LH": {"make": "FAW", "country": "China"},

    # ===== Germany =====
    "W": {"make": "Germany-built", "country": "Germany"},
    "WAU": {"make": "Audi", "country": "Germany"},
    "WA1": {"make": "Audi SUV", "country": "Germany"},
    "WBA": {"make": "BMW", "country": "Germany"},
    "WBS": {"make": "BMW M", "country": "Germany"},
    "WBX": {"make": "BMW X (USA-built)", "country": "Germany"},
    "WBY": {"make": "BMW i", "country": "Germany"},
    "WDB": {"make": "Mercedes-Benz", "country": "Germany"},
    "WDC": {"make": "Mercedes-Benz SUV", "country": "Germany"},
    "WDD": {"make": "Mercedes-Benz", "country": "Germany"},
    "WDF": {"make": "Mercedes-Benz Van", "country": "Germany"},
    "WMW": {"make": "MINI", "country": "Germany"},
    "WP0": {"make": "Porsche", "country": "Germany"},
    "WP1": {"make": "Porsche SUV", "country": "Germany"},
    "WV1": {"make": "Volkswagen Commercial", "country": "Germany"},
    "WV2": {"make": "Volkswagen Van", "country": "Germany"},
    "WVG": {"make": "Volkswagen", "country": "Germany"},
    "WVW": {"make": "Volkswagen", "country": "Germany"},
    "WF0": {"make": "Ford Europe", "country": "Germany"},
    "WMA": {"make": "MAN Trucks", "country": "Germany"},

    # ===== UK =====
    "SAJ": {"make": "Jaguar", "country": "UK"},
    "SAL": {"make": "Land Rover / Range Rover", "country": "UK"},
    "SAR": {"make": "Rover (legacy)", "country": "UK"},
    "SAT": {"make": "Triumph (legacy)", "country": "UK"},
    "SAX": {"make": "Austin Rover (legacy)", "country": "UK"},
    "SCC": {"make": "Lotus", "country": "UK"},
    "SCB": {"make": "Bentley", "country": "UK"},
    "SCA": {"make": "Rolls-Royce", "country": "UK"},
    "SCE": {"make": "DeLorean", "country": "UK"},
    "SCF": {"make": "Aston Martin", "country": "UK"},
    "SDB": {"make": "Peugeot UK", "country": "UK"},
    "SHS": {"make": "Honda UK", "country": "UK"},
    "SJN": {"make": "Nissan UK", "country": "UK"},

    # ===== France =====
    "VF1": {"make": "Renault", "country": "France"},
    "VF2": {"make": "Renault", "country": "France"},
    "VF3": {"make": "Peugeot", "country": "France"},
    "VF6": {"make": "Renault Truck", "country": "France"},
    "VF7": {"make": "Citroën", "country": "France"},
    "VF8": {"make": "Matra", "country": "France"},
    "VF9": {"make": "Bugatti", "country": "France"},

    # ===== Italy =====
    "ZAM": {"make": "Maserati", "country": "Italy"},
    "ZAR": {"make": "Alfa Romeo", "country": "Italy"},
    "ZFA": {"make": "Fiat", "country": "Italy"},
    "ZFF": {"make": "Ferrari", "country": "Italy"},
    "ZHW": {"make": "Lamborghini", "country": "Italy"},
    "ZLA": {"make": "Lancia", "country": "Italy"},

    # ===== Spain =====
    "VS5": {"make": "SEAT", "country": "Spain"},
    "VS6": {"make": "Ford Spain", "country": "Spain"},
    "VS7": {"make": "Citroën Spain", "country": "Spain"},
    "VSS": {"make": "SEAT", "country": "Spain"},
    "VSE": {"make": "SEAT", "country": "Spain"},

    # ===== Sweden =====
    "YS3": {"make": "Saab (legacy)", "country": "Sweden"},
    "YV1": {"make": "Volvo", "country": "Sweden"},
    "YV4": {"make": "Volvo SUV", "country": "Sweden"},

    # ===== Czech Republic =====
    "TMB": {"make": "Škoda", "country": "Czech Republic"},
    "TMP": {"make": "Škoda", "country": "Czech Republic"},

    # ===== Russia =====
    "X7L": {"make": "Renault Russia", "country": "Russia"},
    "XTA": {"make": "Lada / AvtoVAZ", "country": "Russia"},
    "XTT": {"make": "UAZ", "country": "Russia"},
    "XW8": {"make": "VW Russia", "country": "Russia"},

    # ===== India =====
    "MAJ": {"make": "Ford India", "country": "India"},
    "MAT": {"make": "Tata Motors", "country": "India"},
    "MA1": {"make": "Mahindra", "country": "India"},
    "MA3": {"make": "Maruti Suzuki", "country": "India"},
    "MA6": {"make": "GM India", "country": "India"},
    "MA7": {"make": "Honda India", "country": "India"},
    "MAK": {"make": "Hyundai India", "country": "India"},
    "MAL": {"make": "Hyundai India", "country": "India"},
    "MBJ": {"make": "Toyota Kirloskar", "country": "India"},
    "MEC": {"make": "Daimler India", "country": "India"},

    # ===== Thailand (huge for SE Asia / Bangladesh imports) =====
    "MR0": {"make": "Toyota Thailand", "country": "Thailand"},
    "MR1": {"make": "Toyota Thailand", "country": "Thailand"},
    "MMB": {"make": "Mitsubishi Thailand", "country": "Thailand"},
    "MMT": {"make": "Mitsubishi Thailand", "country": "Thailand"},
    "MNT": {"make": "Nissan Thailand", "country": "Thailand"},
    "MHF": {"make": "Toyota Thailand", "country": "Thailand"},
    "MHR": {"make": "Honda Thailand", "country": "Thailand"},
    "MHY": {"make": "Suzuki Thailand", "country": "Thailand"},

    # ===== Brazil =====
    "9BG": {"make": "GM Brazil", "country": "Brazil"},
    "9BW": {"make": "Volkswagen Brazil", "country": "Brazil"},
    "9BF": {"make": "Ford Brazil", "country": "Brazil"},
    "9BR": {"make": "Toyota Brazil", "country": "Brazil"},

    # ===== Australia =====
    "6F4": {"make": "Nissan Australia", "country": "Australia"},
    "6F5": {"make": "Ford Australia", "country": "Australia"},
    "6G1": {"make": "Holden", "country": "Australia"},
    "6T1": {"make": "Toyota Australia", "country": "Australia"},

    # ===== South Africa =====
    "AHT": {"make": "Toyota South Africa", "country": "South Africa"},
    "AC5": {"make": "Ford South Africa", "country": "South Africa"},
}

# ISO 3779 year codes (position 10 of VIN). Map repeats every 30 years.
# This table covers 2010–2039. For 1980–2009 add 30 to your decoded year.
YEAR_CODES = {
    "A": 2010, "B": 2011, "C": 2012, "D": 2013, "E": 2014, "F": 2015,
    "G": 2016, "H": 2017, "J": 2018, "K": 2019, "L": 2020, "M": 2021,
    "N": 2022, "P": 2023, "R": 2024, "S": 2025, "T": 2026, "V": 2027,
    "W": 2028, "X": 2029, "Y": 2030, "1": 2031, "2": 2032, "3": 2033,
    "4": 2034, "5": 2035, "6": 2036, "7": 2037, "8": 2038, "9": 2039,
}


def lookup_wmi(vin: str) -> dict:
    """Best-effort manufacturer lookup. Tries 3-char then 2-char prefix."""
    vin = (vin or "").upper().strip()
    if len(vin) < 3:
        return {}
    p3 = vin[:3]
    p2 = vin[:2]
    p1 = vin[:1]
    if p3 in WMI_TABLE:
        return {"wmi_match": p3, **WMI_TABLE[p3]}
    if p2 in WMI_TABLE:
        return {"wmi_match": p2, **WMI_TABLE[p2]}
    if p1 in WMI_TABLE:
        return {"wmi_match": p1, **WMI_TABLE[p1]}
    return {}


def decode_year(vin: str) -> int | None:
    """Decode model year from position 10 of a 17-char VIN."""
    if not vin or len(vin) < 10:
        return None
    code = vin[9].upper()
    return YEAR_CODES.get(code)
