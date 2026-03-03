/**
 * 20 hardcoded regions for MVP
 * Region ID → ISO Code → Country Name
 */
export const REGIONS = {
  0: { iso: 'US', name: 'United States', coords: [-95.7129, 37.0902] },
  1: { iso: 'CA', name: 'Canada', coords: [-106.3468, 56.1304] },
  2: { iso: 'BR', name: 'Brazil', coords: [-51.9253, -14.2350] },
  3: { iso: 'AR', name: 'Argentina', coords: [-63.6167, -38.4161] },
  4: { iso: 'GB', name: 'United Kingdom', coords: [-3.4360, 55.3781] },
  5: { iso: 'FR', name: 'France', coords: [2.2137, 46.2276] },
  6: { iso: 'DE', name: 'Germany', coords: [10.4515, 51.1657] },
  7: { iso: 'RU', name: 'Russia', coords: [105.3188, 61.5240] },
  8: { iso: 'CN', name: 'China', coords: [104.1954, 35.8617] },
  9: { iso: 'IN', name: 'India', coords: [78.9629, 20.5937] },
  10: { iso: 'AU', name: 'Australia', coords: [133.7751, -25.2744] },
  11: { iso: 'JP', name: 'Japan', coords: [138.2529, 36.2048] },
  12: { iso: 'NG', name: 'Nigeria', coords: [8.6753, 9.0820] },
  13: { iso: 'ZA', name: 'South Africa', coords: [22.9375, -30.5595] },
  14: { iso: 'EG', name: 'Egypt', coords: [30.8025, 26.8206] },
  15: { iso: 'SA', name: 'Saudi Arabia', coords: [45.0792, 23.8859] },
  16: { iso: 'PK', name: 'Pakistan', coords: [69.3451, 30.3753] },
  17: { iso: 'ID', name: 'Indonesia', coords: [113.9213, -0.7893] },
  18: { iso: 'TR', name: 'Turkey', coords: [35.2433, 38.9637] },
  19: { iso: 'MX', name: 'Mexico', coords: [-102.5528, 23.6345] },
} as const;

export const REGION_IDS = Object.keys(REGIONS).map(Number) as number[];
export const REGION_ISOS = Object.values(REGIONS).map(r => r.iso);
