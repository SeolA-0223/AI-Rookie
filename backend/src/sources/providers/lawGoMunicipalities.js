import { normalizeEnvValue } from "../shared.js";

export const LAW_GO_MUNICIPALITIES = [
  { code: "6110000", name: "서울특별시" },
  { code: "6260000", name: "부산광역시" },
  { code: "6270000", name: "대구광역시" },
  { code: "6280000", name: "인천광역시" },
  { code: "6290000", name: "광주광역시" },
  { code: "6300000", name: "대전광역시" },
  { code: "5690000", name: "세종특별자치시" },
  { code: "6310000", name: "울산광역시" },
  { code: "6410000", name: "경기도" },
  { code: "6530000", name: "강원특별자치도" },
  { code: "6430000", name: "충청북도" },
  { code: "6440000", name: "충청남도" },
  { code: "6540000", name: "전북특별자치도" },
  { code: "6460000", name: "전라남도" },
  { code: "6470000", name: "경상북도" },
  { code: "6480000", name: "경상남도" },
  { code: "6500000", name: "제주특별자치도" },
  { code: "6550000", name: "충청권광역연합" }
];

const MUNICIPALITIES_BY_CODE = new Map(LAW_GO_MUNICIPALITIES.map((item) => [item.code, item]));
const MUNICIPALITIES_BY_NAME = new Map(
  LAW_GO_MUNICIPALITIES.map((item) => [item.name.replace(/\s+/g, "").toLowerCase(), item])
);

export function normalizeMunicipalityCodes(values = []) {
  const normalizedValues = Array.isArray(values) ? values : [values];
  const seen = new Set();
  const resolvedCodes = [];

  for (const value of normalizedValues) {
    const normalizedValue = normalizeEnvValue(value);
    if (!normalizedValue) {
      continue;
    }

    const directCode = MUNICIPALITIES_BY_CODE.get(normalizedValue)?.code;
    if (directCode && !seen.has(directCode)) {
      seen.add(directCode);
      resolvedCodes.push(directCode);
      continue;
    }

    const normalizedName = normalizedValue.replace(/\s+/g, "").toLowerCase();
    const byName = MUNICIPALITIES_BY_NAME.get(normalizedName)?.code;

    if (byName && !seen.has(byName)) {
      seen.add(byName);
      resolvedCodes.push(byName);
    }
  }

  return resolvedCodes;
}

export function getMunicipalityNames(values = []) {
  return normalizeMunicipalityCodes(values)
    .map((code) => MUNICIPALITIES_BY_CODE.get(code)?.name ?? "")
    .filter(Boolean);
}
