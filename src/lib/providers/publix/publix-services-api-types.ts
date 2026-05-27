export const PUBLIX_SERVICES_API_SPEC = {
  baseUrl: "https://services.publix.com",
  storeLocationPath: "/api/v1/storelocation",
} as const;

export type PublixStoreRecord = {
  KEY?: string;
  NAME?: string;
  SHORTNAME?: string;
  ADDR?: string;
  CITY?: string;
  STATE?: string;
  ZIP?: string;
  PHONE?: string;
  OPTION?: string;
  CLAT?: string;
  CLON?: string;
  DISTANCE?: string;
  WASTORENUM?: string;
};

export type PublixStoreLocationResponse = {
  Stores?: PublixStoreRecord[];
};

export type PublixStoreSearchFilters = {
  zipCode: string;
  count?: number;
};

export type PublixStoreCookie = {
  StoreName: string;
  StoreNumber: number;
  Option: string;
  ShortStoreName: string;
};
