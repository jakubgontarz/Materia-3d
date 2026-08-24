import { Section } from './types';

export interface CatalogProfileDef {
  name: string;
  h: number; // cm
  b: number; // cm
  tw?: number; // cm
  tf?: number; // cm
  t?: number; // cm
  A: number; // cm2
  Iy: number; // cm4 (strong axis)
  Iz: number; // cm4 (weak axis)
  It: number; // cm4 (torsion constant)
  Wy?: number; // cm3
  Wz?: number; // cm3
  Wt?: number; // cm3
  iy?: number; // cm
  iz?: number; // cm
  zs?: number; // cm (for angles / tees centroid)
}

export const CATALOG_IPE: CatalogProfileDef[] = [
  { name: 'IPE 80', h: 8.0, b: 4.6, tw: 0.38, tf: 0.52, A: 7.64, Iy: 80.1, Iz: 8.49, It: 0.70, Wy: 20.0, Wz: 3.69, iy: 3.24, iz: 1.05 },
  { name: 'IPE 100', h: 10.0, b: 5.5, tw: 0.41, tf: 0.57, A: 10.3, Iy: 171.0, Iz: 15.9, It: 1.20, Wy: 34.2, Wz: 5.79, iy: 4.07, iz: 1.24 },
  { name: 'IPE 120', h: 12.0, b: 6.4, tw: 0.44, tf: 0.63, A: 13.2, Iy: 318.0, Iz: 27.7, It: 1.74, Wy: 53.0, Wz: 8.65, iy: 4.90, iz: 1.45 },
  { name: 'IPE 140', h: 14.0, b: 7.3, tw: 0.47, tf: 0.69, A: 16.4, Iy: 541.0, Iz: 44.9, It: 2.45, Wy: 77.3, Wz: 12.3, iy: 5.74, iz: 1.65 },
  { name: 'IPE 160', h: 16.0, b: 8.2, tw: 0.50, tf: 0.74, A: 20.1, Iy: 869.0, Iz: 68.3, It: 3.60, Wy: 109.0, Wz: 16.7, iy: 6.58, iz: 1.84 },
  { name: 'IPE 180', h: 18.0, b: 9.1, tw: 0.53, tf: 0.80, A: 23.9, Iy: 1317.0, Iz: 101.0, It: 4.79, Wy: 146.0, Wz: 22.2, iy: 7.42, iz: 2.05 },
  { name: 'IPE 200', h: 20.0, b: 10.0, tw: 0.56, tf: 0.85, A: 28.5, Iy: 1943.0, Iz: 142.0, It: 6.98, Wy: 194.0, Wz: 28.5, iy: 8.26, iz: 2.24 },
  { name: 'IPE 220', h: 22.0, b: 11.0, tw: 0.59, tf: 0.92, A: 33.4, Iy: 2772.0, Iz: 205.0, It: 9.07, Wy: 252.0, Wz: 37.3, iy: 9.11, iz: 2.48 },
  { name: 'IPE 240', h: 24.0, b: 12.0, tw: 0.62, tf: 0.98, A: 39.1, Iy: 3892.0, Iz: 284.0, It: 12.9, Wy: 324.0, Wz: 47.3, iy: 9.97, iz: 2.69 },
  { name: 'IPE 270', h: 27.0, b: 13.5, tw: 0.66, tf: 1.02, A: 45.9, Iy: 5790.0, Iz: 420.0, It: 15.9, Wy: 429.0, Wz: 62.2, iy: 11.2, iz: 3.02 },
  { name: 'IPE 300', h: 30.0, b: 15.0, tw: 0.71, tf: 1.07, A: 53.8, Iy: 8356.0, Iz: 604.0, It: 20.1, Wy: 557.0, Wz: 80.5, iy: 12.5, iz: 3.35 },
  { name: 'IPE 330', h: 33.0, b: 16.0, tw: 0.75, tf: 1.15, A: 62.6, Iy: 11770.0, Iz: 788.0, It: 28.2, Wy: 713.0, Wz: 98.5, iy: 13.7, iz: 3.55 },
  { name: 'IPE 360', h: 36.0, b: 17.0, tw: 0.80, tf: 1.27, A: 72.7, Iy: 16270.0, Iz: 1043.0, It: 37.3, Wy: 904.0, Wz: 123.0, iy: 15.0, iz: 3.79 },
  { name: 'IPE 400', h: 40.0, b: 18.0, tw: 0.86, tf: 1.35, A: 84.5, Iy: 23130.0, Iz: 1318.0, It: 51.1, Wy: 1160.0, Wz: 146.0, iy: 16.5, iz: 3.95 },
  { name: 'IPE 450', h: 45.0, b: 19.0, tw: 0.94, tf: 1.46, A: 98.8, Iy: 33740.0, Iz: 1676.0, It: 66.9, Wy: 1500.0, Wz: 176.0, iy: 18.5, iz: 4.12 },
  { name: 'IPE 500', h: 50.0, b: 20.0, tw: 1.02, tf: 1.60, A: 116.0, Iy: 48200.0, Iz: 2142.0, It: 89.3, Wy: 1930.0, Wz: 214.0, iy: 20.4, iz: 4.31 },
  { name: 'IPE 550', h: 55.0, b: 21.0, tw: 1.11, tf: 1.72, A: 134.0, Iy: 67120.0, Iz: 2668.0, It: 123.0, Wy: 2440.0, Wz: 254.0, iy: 22.3, iz: 4.45 },
  { name: 'IPE 600', h: 60.0, b: 22.0, tw: 1.20, tf: 1.90, A: 156.0, Iy: 92080.0, Iz: 3387.0, It: 165.0, Wy: 3070.0, Wz: 308.0, iy: 24.3, iz: 4.66 },
];

export const CATALOG_HEA: CatalogProfileDef[] = [
  { name: 'HEA 100', h: 9.6, b: 10.0, tw: 0.50, tf: 0.80, A: 21.2, Iy: 349.0, Iz: 134.0, It: 5.24, Wy: 72.8, Wz: 26.8, iy: 4.06, iz: 2.51 },
  { name: 'HEA 120', h: 11.4, b: 12.0, tw: 0.50, tf: 0.80, A: 25.3, Iy: 606.0, Iz: 231.0, It: 6.00, Wy: 106.0, Wz: 38.5, iy: 4.89, iz: 3.02 },
  { name: 'HEA 140', h: 13.3, b: 14.0, tw: 0.55, tf: 0.85, A: 31.4, Iy: 1033.0, Iz: 389.0, It: 8.13, Wy: 155.0, Wz: 55.6, iy: 5.73, iz: 3.52 },
  { name: 'HEA 160', h: 15.2, b: 16.0, tw: 0.60, tf: 0.90, A: 38.8, Iy: 1673.0, Iz: 616.0, It: 12.2, Wy: 220.0, Wz: 76.9, iy: 6.57, iz: 3.98 },
  { name: 'HEA 180', h: 17.1, b: 18.0, tw: 0.60, tf: 0.95, A: 45.3, Iy: 2510.0, Iz: 925.0, It: 14.8, Wy: 294.0, Wz: 103.0, iy: 7.45, iz: 4.52 },
  { name: 'HEA 200', h: 19.0, b: 20.0, tw: 0.65, tf: 1.00, A: 53.8, Iy: 3692.0, Iz: 1336.0, It: 21.0, Wy: 389.0, Wz: 134.0, iy: 8.28, iz: 4.98 },
  { name: 'HEA 220', h: 21.0, b: 22.0, tw: 0.70, tf: 1.10, A: 64.3, Iy: 5410.0, Iz: 1955.0, It: 28.5, Wy: 515.0, Wz: 178.0, iy: 9.17, iz: 5.51 },
  { name: 'HEA 240', h: 23.0, b: 24.0, tw: 0.75, tf: 1.20, A: 76.8, Iy: 7763.0, Iz: 2769.0, It: 41.6, Wy: 675.0, Wz: 231.0, iy: 10.1, iz: 6.00 },
  { name: 'HEA 260', h: 25.0, b: 26.0, tw: 0.75, tf: 1.25, A: 86.8, Iy: 10450.0, Iz: 3668.0, It: 52.4, Wy: 836.0, Wz: 282.0, iy: 11.0, iz: 6.50 },
  { name: 'HEA 280', h: 27.0, b: 28.0, tw: 0.80, tf: 1.30, A: 97.3, Iy: 13670.0, Iz: 4763.0, It: 65.2, Wy: 1010.0, Wz: 340.0, iy: 11.9, iz: 7.00 },
  { name: 'HEA 300', h: 29.0, b: 30.0, tw: 0.85, tf: 1.40, A: 112.5, Iy: 18260.0, Iz: 6310.0, It: 85.1, Wy: 1260.0, Wz: 421.0, iy: 12.7, iz: 7.49 },
  { name: 'HEA 320', h: 31.0, b: 30.0, tw: 0.90, tf: 1.55, A: 124.4, Iy: 22930.0, Iz: 6985.0, It: 108.0, Wy: 1480.0, Wz: 466.0, iy: 13.6, iz: 7.49 },
  { name: 'HEA 340', h: 33.0, b: 30.0, tw: 0.95, tf: 1.65, A: 133.5, Iy: 27690.0, Iz: 7436.0, It: 128.0, Wy: 1680.0, Wz: 496.0, iy: 14.4, iz: 7.46 },
  { name: 'HEA 360', h: 35.0, b: 30.0, tw: 1.00, tf: 1.75, A: 142.8, Iy: 33090.0, Iz: 7887.0, It: 149.0, Wy: 1890.0, Wz: 526.0, iy: 15.2, iz: 7.43 },
  { name: 'HEA 400', h: 39.0, b: 30.0, tw: 1.10, tf: 1.90, A: 159.0, Iy: 45070.0, Iz: 8564.0, It: 189.0, Wy: 2310.0, Wz: 571.0, iy: 16.8, iz: 7.34 },
];

export const CATALOG_HEB: CatalogProfileDef[] = [
  { name: 'HEB 100', h: 10.0, b: 10.0, tw: 0.60, tf: 1.00, A: 26.0, Iy: 450.0, Iz: 167.0, It: 9.25, Wy: 89.9, Wz: 33.5, iy: 4.16, iz: 2.53 },
  { name: 'HEB 120', h: 12.0, b: 12.0, tw: 0.65, tf: 1.10, A: 34.0, Iy: 864.0, Iz: 318.0, It: 14.4, Wy: 144.0, Wz: 52.9, iy: 5.04, iz: 3.06 },
  { name: 'HEB 140', h: 14.0, b: 14.0, tw: 0.70, tf: 1.20, A: 43.0, Iy: 1509.0, Iz: 550.0, It: 22.5, Wy: 216.0, Wz: 78.5, iy: 5.93, iz: 3.58 },
  { name: 'HEB 160', h: 16.0, b: 16.0, tw: 0.80, tf: 1.30, A: 54.3, Iy: 2492.0, Iz: 889.0, It: 31.4, Wy: 311.0, Wz: 111.0, iy: 6.78, iz: 4.05 },
  { name: 'HEB 180', h: 18.0, b: 18.0, tw: 0.85, tf: 1.40, A: 65.3, Iy: 3831.0, Iz: 1363.0, It: 42.2, Wy: 426.0, Wz: 151.0, iy: 7.66, iz: 4.57 },
  { name: 'HEB 200', h: 20.0, b: 20.0, tw: 0.90, tf: 1.50, A: 78.1, Iy: 5696.0, Iz: 2003.0, It: 59.3, Wy: 570.0, Wz: 200.0, iy: 8.54, iz: 5.07 },
  { name: 'HEB 220', h: 22.0, b: 22.0, tw: 0.95, tf: 1.60, A: 91.0, Iy: 8091.0, Iz: 2843.0, It: 76.6, Wy: 736.0, Wz: 258.0, iy: 9.43, iz: 5.59 },
  { name: 'HEB 240', h: 24.0, b: 24.0, tw: 1.00, tf: 1.70, A: 106.0, Iy: 11260.0, Iz: 3923.0, It: 103.0, Wy: 938.0, Wz: 327.0, iy: 10.3, iz: 6.08 },
  { name: 'HEB 260', h: 26.0, b: 26.0, tw: 1.00, tf: 1.75, A: 118.4, Iy: 14920.0, Iz: 5135.0, It: 123.0, Wy: 1150.0, Wz: 395.0, iy: 11.2, iz: 6.58 },
  { name: 'HEB 280', h: 28.0, b: 28.0, tw: 1.05, tf: 1.80, A: 131.4, Iy: 19270.0, Iz: 6595.0, It: 144.0, Wy: 1380.0, Wz: 471.0, iy: 12.1, iz: 7.09 },
  { name: 'HEB 300', h: 30.0, b: 30.0, tw: 1.10, tf: 1.90, A: 149.1, Iy: 25170.0, Iz: 8563.0, It: 185.0, Wy: 1680.0, Wz: 571.0, iy: 13.0, iz: 7.58 },
];

export const CATALOG_IPN: CatalogProfileDef[] = [
  { name: 'IPN 80', h: 8.0, b: 4.2, tw: 0.39, tf: 0.59, A: 7.57, Iy: 77.8, Iz: 6.29, It: 0.85, Wy: 19.5, Wz: 3.00, iy: 3.20, iz: 0.91 },
  { name: 'IPN 100', h: 10.0, b: 5.0, tw: 0.45, tf: 0.68, A: 10.6, Iy: 171.0, Iz: 12.2, It: 1.48, Wy: 34.2, Wz: 4.88, iy: 4.01, iz: 1.07 },
  { name: 'IPN 120', h: 12.0, b: 5.8, tw: 0.51, tf: 0.77, A: 14.2, Iy: 328.0, Iz: 21.5, It: 2.37, Wy: 54.7, Wz: 7.41, iy: 4.81, iz: 1.23 },
  { name: 'IPN 140', h: 14.0, b: 6.6, tw: 0.57, tf: 0.86, A: 18.2, Iy: 573.0, Iz: 35.2, It: 3.56, Wy: 81.9, Wz: 10.7, iy: 5.61, iz: 1.39 },
  { name: 'IPN 160', h: 16.0, b: 7.4, tw: 0.63, tf: 0.95, A: 22.8, Iy: 935.0, Iz: 54.7, It: 5.16, Wy: 117.0, Wz: 14.8, iy: 6.40, iz: 1.55 },
  { name: 'IPN 180', h: 18.0, b: 8.2, tw: 0.69, tf: 1.04, A: 27.9, Iy: 1450.0, Iz: 81.3, It: 7.27, Wy: 161.0, Wz: 19.8, iy: 7.20, iz: 1.71 },
  { name: 'IPN 200', h: 20.0, b: 9.0, tw: 0.75, tf: 1.13, A: 33.4, Iy: 2140.0, Iz: 117.0, It: 9.98, Wy: 214.0, Wz: 26.0, iy: 8.00, iz: 1.87 },
  { name: 'IPN 220', h: 22.0, b: 9.8, tw: 0.81, tf: 1.22, A: 39.5, Iy: 3060.0, Iz: 162.0, It: 13.4, Wy: 278.0, Wz: 33.1, iy: 8.80, iz: 2.02 },
  { name: 'IPN 240', h: 24.0, b: 10.6, tw: 0.87, tf: 1.31, A: 46.1, Iy: 4250.0, Iz: 221.0, It: 17.6, Wy: 354.0, Wz: 41.7, iy: 9.59, iz: 2.19 },
];

export const CATALOG_UPN: CatalogProfileDef[] = [
  { name: 'UPN 80', h: 8.0, b: 4.5, tw: 0.60, tf: 0.80, A: 11.0, Iy: 106.0, Iz: 19.4, It: 1.90, Wy: 26.5, Wz: 6.36, iy: 3.10, iz: 1.33 },
  { name: 'UPN 100', h: 10.0, b: 5.0, tw: 0.60, tf: 0.85, A: 13.5, Iy: 206.0, Iz: 29.3, It: 2.70, Wy: 41.2, Wz: 8.49, iy: 3.91, iz: 1.47 },
  { name: 'UPN 120', h: 12.0, b: 5.5, tw: 0.70, tf: 0.90, A: 17.0, Iy: 364.0, Iz: 43.2, It: 3.80, Wy: 60.7, Wz: 11.1, iy: 4.62, iz: 1.59 },
  { name: 'UPN 140', h: 14.0, b: 6.0, tw: 0.70, tf: 1.00, A: 20.4, Iy: 605.0, Iz: 62.7, It: 5.70, Wy: 86.4, Wz: 14.8, iy: 5.45, iz: 1.75 },
  { name: 'UPN 160', h: 16.0, b: 6.5, tw: 0.75, tf: 1.05, A: 24.0, Iy: 925.0, Iz: 85.3, It: 7.70, Wy: 116.0, Wz: 18.3, iy: 6.21, iz: 1.89 },
  { name: 'UPN 180', h: 18.0, b: 7.0, tw: 0.80, tf: 1.10, A: 28.0, Iy: 1350.0, Iz: 114.0, It: 10.2, Wy: 150.0, Wz: 22.4, iy: 6.95, iz: 2.02 },
  { name: 'UPN 200', h: 20.0, b: 7.5, tw: 0.85, tf: 1.15, A: 32.2, Iy: 1910.0, Iz: 148.0, It: 13.3, Wy: 191.0, Wz: 27.0, iy: 7.70, iz: 2.14 },
];

export const CATALOG_RHS: CatalogProfileDef[] = [
  { name: 'RHS 60x40x3', h: 6.0, b: 4.0, t: 0.3, A: 5.45, Iy: 27.4, Iz: 14.3, It: 26.5, Wy: 9.14, Wz: 7.15, iy: 2.24, iz: 1.62 },
  { name: 'RHS 80x40x3', h: 8.0, b: 4.0, t: 0.3, A: 6.65, Iy: 57.5, Iz: 18.9, It: 39.8, Wy: 14.4, Wz: 9.47, iy: 2.94, iz: 1.69 },
  { name: 'RHS 100x50x4', h: 10.0, b: 5.0, t: 0.4, A: 11.0, Iy: 149.0, Iz: 49.3, It: 112.0, Wy: 29.8, Wz: 19.7, iy: 3.68, iz: 2.12 },
  { name: 'RHS 120x60x5', h: 12.0, b: 6.0, t: 0.5, A: 16.5, Iy: 317.0, Iz: 104.0, It: 247.0, Wy: 52.8, Wz: 34.7, iy: 4.38, iz: 2.51 },
  { name: 'RHS 140x80x5', h: 14.0, b: 8.0, t: 0.5, A: 20.5, Iy: 569.0, Iz: 236.0, It: 488.0, Wy: 81.3, Wz: 59.0, iy: 5.27, iz: 3.39 },
  { name: 'RHS 160x80x6', h: 16.0, b: 8.0, t: 0.6, A: 26.6, Iy: 934.0, Iz: 326.0, It: 739.0, Wy: 117.0, Wz: 81.5, iy: 5.92, iz: 3.50 },
  { name: 'RHS 200x100x6', h: 20.0, b: 10.0, t: 0.6, A: 33.8, Iy: 1930.0, Iz: 651.0, It: 1530.0, Wy: 193.0, Wz: 130.0, iy: 7.56, iz: 4.39 },
];

export const CATALOG_SHS: CatalogProfileDef[] = [
  { name: 'SHS 50x50x3', h: 5.0, b: 5.0, t: 0.3, A: 5.45, Iy: 19.6, Iz: 19.6, It: 30.5, Wy: 7.84, Wz: 7.84, iy: 1.90, iz: 1.90 },
  { name: 'SHS 60x60x4', h: 6.0, b: 6.0, t: 0.4, A: 8.65, Iy: 43.8, Iz: 43.8, It: 68.2, Wy: 14.6, Wz: 14.6, iy: 2.25, iz: 2.25 },
  { name: 'SHS 80x80x4', h: 8.0, b: 8.0, t: 0.4, A: 11.8, Iy: 116.0, Iz: 116.0, It: 181.0, Wy: 29.0, Wz: 29.0, iy: 3.13, iz: 3.13 },
  { name: 'SHS 100x100x5', h: 10.0, b: 10.0, t: 0.5, A: 18.5, Iy: 279.0, Iz: 279.0, It: 442.0, Wy: 55.8, Wz: 55.8, iy: 3.88, iz: 3.88 },
  { name: 'SHS 120x120x6', h: 12.0, b: 12.0, t: 0.6, A: 26.6, Iy: 574.0, Iz: 574.0, It: 916.0, Wy: 95.7, Wz: 95.7, iy: 4.65, iz: 4.65 },
  { name: 'SHS 150x150x6', h: 15.0, b: 15.0, t: 0.6, A: 33.8, Iy: 1190.0, Iz: 1190.0, It: 1890.0, Wy: 159.0, Wz: 159.0, iy: 5.93, iz: 5.93 },
  { name: 'SHS 200x200x8', h: 20.0, b: 20.0, t: 0.8, A: 59.4, Iy: 3660.0, Iz: 3660.0, It: 5850.0, Wy: 366.0, Wz: 366.0, iy: 7.85, iz: 7.85 },
];

export const CATALOG_CHS: CatalogProfileDef[] = [
  { name: 'RO Ø48.3x3.2', h: 4.83, b: 4.83, t: 0.32, A: 4.53, Iy: 11.6, Iz: 11.6, It: 23.2, Wy: 4.80, Wz: 4.80, iy: 1.60, iz: 1.60 },
  { name: 'RO Ø60.3x3.6', h: 6.03, b: 6.03, t: 0.36, A: 6.41, Iy: 26.4, Iz: 26.4, It: 52.8, Wy: 8.76, Wz: 8.76, iy: 2.03, iz: 2.03 },
  { name: 'RO Ø76.1x4.0', h: 7.61, b: 7.61, t: 0.40, A: 9.06, Iy: 58.2, Iz: 58.2, It: 116.0, Wy: 15.3, Wz: 15.3, iy: 2.54, iz: 2.54 },
  { name: 'RO Ø88.9x4.0', h: 8.89, b: 8.89, t: 0.40, A: 10.7, Iy: 97.4, Iz: 97.4, It: 195.0, Wy: 21.9, Wz: 21.9, iy: 3.02, iz: 3.02 },
  { name: 'RO Ø114.3x5.0', h: 11.43, b: 11.43, t: 0.50, A: 17.2, Iy: 257.0, Iz: 257.0, It: 514.0, Wy: 45.0, Wz: 45.0, iy: 3.86, iz: 3.86 },
  { name: 'RO Ø139.7x5.0', h: 13.97, b: 13.97, t: 0.50, A: 21.2, Iy: 480.0, Iz: 480.0, It: 960.0, Wy: 68.7, Wz: 68.7, iy: 4.76, iz: 4.76 },
  { name: 'RO Ø168.3x6.3', h: 16.83, b: 16.83, t: 0.63, A: 32.1, Iy: 1050.0, Iz: 1050.0, It: 2100.0, Wy: 125.0, Wz: 125.0, iy: 5.72, iz: 5.72 },
  { name: 'RO Ø219.1x8.0', h: 21.91, b: 21.91, t: 0.80, A: 53.1, Iy: 2980.0, Iz: 2980.0, It: 5960.0, Wy: 272.0, Wz: 272.0, iy: 7.49, iz: 7.49 },
];

export const CATALOG_L: CatalogProfileDef[] = [
  { name: 'L 30x30x3', h: 3.0, b: 3.0, t: 0.3, A: 1.74, Iy: 1.40, Iz: 1.40, It: 0.05, zs: 0.83, iy: 0.89, iz: 0.89 },
  { name: 'L 40x40x4', h: 4.0, b: 4.0, t: 0.4, A: 3.08, Iy: 4.47, Iz: 4.47, It: 0.16, zs: 1.11, iy: 1.20, iz: 1.20 },
  { name: 'L 50x50x5', h: 5.0, b: 5.0, t: 0.5, A: 4.80, Iy: 11.0, Iz: 11.0, It: 0.40, zs: 1.40, iy: 1.51, iz: 1.51 },
  { name: 'L 60x60x6', h: 6.0, b: 6.0, t: 0.6, A: 6.91, Iy: 22.8, Iz: 22.8, It: 0.83, zs: 1.69, iy: 1.82, iz: 1.82 },
  { name: 'L 70x70x7', h: 7.0, b: 7.0, t: 0.7, A: 9.40, Iy: 42.3, Iz: 42.3, It: 1.54, zs: 1.97, iy: 2.12, iz: 2.12 },
  { name: 'L 80x80x8', h: 8.0, b: 8.0, t: 0.8, A: 12.3, Iy: 72.3, Iz: 72.3, It: 2.62, zs: 2.26, iy: 2.43, iz: 2.43 },
  { name: 'L 100x100x10', h: 10.0, b: 10.0, t: 1.0, A: 19.2, Iy: 177.0, Iz: 177.0, It: 6.40, zs: 2.82, iy: 3.04, iz: 3.04 },
];

export const CATALOG_UPE: CatalogProfileDef[] = [
  { name: 'UPE 80', h: 8.0, b: 5.0, tw: 0.45, tf: 0.75, A: 10.1, Iy: 107.0, Iz: 32.1, It: 1.48, Wy: 26.8, Wz: 9.87, iy: 3.26, iz: 1.78 },
  { name: 'UPE 100', h: 10.0, b: 5.5, tw: 0.45, tf: 0.80, A: 12.5, Iy: 207.0, Iz: 48.0, It: 1.96, Wy: 41.4, Wz: 13.5, iy: 4.07, iz: 1.96 },
  { name: 'UPE 120', h: 12.0, b: 6.0, tw: 0.50, tf: 0.85, A: 15.4, Iy: 364.0, Iz: 72.0, It: 2.76, Wy: 60.7, Wz: 18.3, iy: 4.86, iz: 2.16 },
  { name: 'UPE 140', h: 14.0, b: 6.5, tw: 0.50, tf: 0.90, A: 18.4, Iy: 599.0, Iz: 104.0, It: 3.65, Wy: 85.6, Wz: 24.3, iy: 5.71, iz: 2.38 },
  { name: 'UPE 160', h: 16.0, b: 7.0, tw: 0.55, tf: 0.95, A: 21.7, Iy: 911.0, Iz: 145.0, It: 4.83, Wy: 114.0, Wz: 31.4, iy: 6.48, iz: 2.58 },
  { name: 'UPE 180', h: 18.0, b: 7.5, tw: 0.55, tf: 1.00, A: 25.1, Iy: 1350.0, Iz: 198.0, It: 6.13, Wy: 150.0, Wz: 40.0, iy: 7.33, iz: 2.81 },
  { name: 'UPE 200', h: 20.0, b: 8.0, tw: 0.60, tf: 1.10, A: 29.0, Iy: 1910.0, Iz: 270.0, It: 8.12, Wy: 191.0, Wz: 51.5, iy: 8.12, iz: 3.05 },
];

export const CATALOG_TEE: CatalogProfileDef[] = [
  { name: 'T 30', h: 3.0, b: 3.0, tw: 0.40, tf: 0.40, A: 2.26, Iy: 1.72, Iz: 0.87, It: 0.12, Wy: 2.01, Wz: 0.80, iy: 0.87, iz: 0.62 },
  { name: 'T 40', h: 4.0, b: 4.0, tw: 0.50, tf: 0.50, A: 3.77, Iy: 5.28, Iz: 2.68, It: 0.31, Wy: 4.58, Wz: 1.84, iy: 1.18, iz: 0.84 },
  { name: 'T 50', h: 5.0, b: 5.0, tw: 0.60, tf: 0.60, A: 5.66, Iy: 12.1, Iz: 6.15, It: 0.68, Wy: 8.65, Wz: 3.36, iy: 1.46, iz: 1.04 },
  { name: 'T 60', h: 6.0, b: 6.0, tw: 0.70, tf: 0.70, A: 7.94, Iy: 23.8, Iz: 12.1, It: 1.29, Wy: 14.7, Wz: 5.48, iy: 1.73, iz: 1.23 },
  { name: 'T 80', h: 8.0, b: 8.0, tw: 0.90, tf: 0.90, A: 13.6, Iy: 73.7, Iz: 37.4, It: 3.67, Wy: 34.0, Wz: 12.8, iy: 2.33, iz: 1.66 },
  { name: 'T 100', h: 10.0, b: 10.0, tw: 1.10, tf: 1.10, A: 20.8, Iy: 178.0, Iz: 90.6, It: 8.41, Wy: 65.1, Wz: 24.6, iy: 2.92, iz: 2.09 },
];

export const CATALOG_DEFS: Record<string, { label: string; data: CatalogProfileDef[]; kind: string }> = {
  IPE: { label: 'IPE — dwuteownik europejski', data: CATALOG_IPE, kind: 'sym' },
  HEA: { label: 'HEA — dwuteownik szerokostopowy lekki', data: CATALOG_HEA, kind: 'sym' },
  HEB: { label: 'HEB — dwuteownik szerokostopowy standard', data: CATALOG_HEB, kind: 'sym' },
  IPN: { label: 'IPN — dwuteownik wąski', data: CATALOG_IPN, kind: 'sym' },
  UPN: { label: 'UPN — ceownik walcowany', data: CATALOG_UPN, kind: 'sym' },
  UPE: { label: 'UPE — ceownik o równoległych stopkach', data: CATALOG_UPE, kind: 'sym' },
  T: { label: 'T — teownik walcowany', data: CATALOG_TEE, kind: 'tee' },
  SHS: { label: 'SHS — rura kwadratowa', data: CATALOG_SHS, kind: 'sym' },
  RHS: { label: 'RHS — rura prostokątna', data: CATALOG_RHS, kind: 'sym' },
  CHS: { label: 'CHS — rura okrągła', data: CATALOG_CHS, kind: 'sym' },
  L: { label: 'L — kątownik równoramienny', data: CATALOG_L, kind: 'angle' },
};

export const CATALOG_ORDER = ['IPE', 'HEA', 'HEB', 'IPN', 'UPN', 'UPE', 'T', 'SHS', 'RHS', 'CHS', 'L'];

export const INITIAL_MATERIALS = [
  { id: 1, name: 'Stal S235 / S355', E: 210, nu: 0.3, G: 80.77, alpha: 1.2, density: 7850 },
  { id: 2, name: 'Beton C25/30', E: 31, nu: 0.2, G: 12.92, alpha: 1.0, density: 2500 },
  { id: 3, name: 'Drewno C24', E: 11, nu: 0.05, G: 0.69, alpha: 0.5, density: 420 },
  { id: 4, name: 'Aluminium 6061-T6', E: 70, nu: 0.33, G: 26.32, alpha: 2.3, density: 2700 },
];

export const INITIAL_SECTIONS: Section[] = [
  {
    id: 1,
    name: 'HEB 200',
    shape: 'catHEB',
    category: 'katalog',
    A: 78.1,
    Iy: 5696.0,
    Iz: 2003.0,
    It: 59.3,
    Wy: 570.0,
    Wz: 200.0,
    h: 20.0,
    b: 20.0,
    tf: 1.5,
    tw: 0.9,
    cTopY: 10.0,
    cBotY: 10.0,
    cTopZ: 10.0,
    cBotZ: 10.0
  },
  {
    id: 2,
    name: 'IPE 240',
    shape: 'catIPE',
    category: 'katalog',
    A: 39.1,
    Iy: 3892.0,
    Iz: 284.0,
    It: 12.9,
    Wy: 324.0,
    Wz: 47.3,
    h: 24.0,
    b: 12.0,
    tf: 0.98,
    tw: 0.62,
    cTopY: 12.0,
    cBotY: 12.0,
    cTopZ: 6.0,
    cBotZ: 6.0
  },
  {
    id: 3,
    name: 'Rura RO Ø114.3x5',
    shape: 'pipe',
    category: 'ksztalt',
    A: 17.2,
    Iy: 257.0,
    Iz: 257.0,
    It: 514.0,
    Wy: 45.0,
    Wz: 45.0,
    h: 11.43,
    b: 11.43,
    t: 0.5,
    cTopY: 5.715,
    cBotY: 5.715,
    cTopZ: 5.715,
    cBotZ: 5.715
  },
  {
    id: 4,
    name: 'Słup żelbetowy 30x30 cm',
    shape: 'rect',
    category: 'ksztalt',
    A: 900.0,
    Iy: 67500.0,
    Iz: 67500.0,
    It: 113400.0,
    Wy: 4500.0,
    Wz: 4500.0,
    h: 30.0,
    b: 30.0,
    cTopY: 15.0,
    cBotY: 15.0,
    cTopZ: 15.0,
    cBotZ: 15.0
  }
];
