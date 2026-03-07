export interface PokemonApiListItem {
  name: string;
  url: string;
}

export interface PokemonApiListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PokemonApiListItem[];
}

export interface PokemonListItem {
  id: number | null;
  slug: string;
  displayName: string;
  apiUrl: string;
}

export interface PokemonDirectory {
  totalCount: number;
  nextPage: string | null;
  previousPage: string | null;
  items: PokemonListItem[];
}
