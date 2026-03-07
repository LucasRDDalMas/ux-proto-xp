import { cache } from "react";

import type {
  PokemonApiListResponse,
  PokemonDirectory,
  PokemonListItem,
} from "@/types/pokemon";

const REVALIDATE_INTERVAL_IN_SECONDS = 60 * 60 * 24;

type JsonRecord = Record<string, unknown>;

function getPokemonApiUrl(): string {
  const url = process.env.POKEAPI_URL?.trim();

  if (!url) {
    throw new Error("Missing POKEAPI_URL environment variable.");
  }

  try {
    return new URL(url).toString();
  } catch {
    throw new Error("POKEAPI_URL must be a valid URL.");
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected ${fieldName} to be a string.`);
  }

  return value;
}

function readNullableString(value: unknown, fieldName: string): string | null {
  if (value === null) {
    return null;
  }

  return readString(value, fieldName);
}

function readNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Expected ${fieldName} to be a number.`);
  }

  return value;
}

function extractPokemonId(apiUrl: string): number | null {
  try {
    const pathnameParts = new URL(apiUrl).pathname.split("/").filter(Boolean);
    const rawId = pathnameParts.at(-1);

    if (!rawId) {
      return null;
    }

    const id = Number(rawId);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

function formatPokemonName(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapPokemonListItem(value: unknown): PokemonListItem {
  if (!isRecord(value)) {
    throw new Error("Expected each Pokemon entry to be an object.");
  }

  const slug = readString(value.name, "results[].name");
  const apiUrl = readString(value.url, "results[].url");

  return {
    id: extractPokemonId(apiUrl),
    slug,
    displayName: formatPokemonName(slug),
    apiUrl,
  };
}

function mapPokemonListResponse(value: unknown): PokemonDirectory {
  if (!isRecord(value)) {
    throw new Error("Expected the Pokemon list response to be an object.");
  }

  const results = value.results;

  if (!Array.isArray(results)) {
    throw new Error("Expected results to be an array.");
  }

  const payload: PokemonApiListResponse = {
    count: readNumber(value.count, "count"),
    next: readNullableString(value.next, "next"),
    previous: readNullableString(value.previous, "previous"),
    results: results.map((entry) => {
      if (!isRecord(entry)) {
        throw new Error("Expected each Pokemon result to be an object.");
      }

      return {
        name: readString(entry.name, "results[].name"),
        url: readString(entry.url, "results[].url"),
      };
    }),
  };

  return {
    totalCount: payload.count,
    nextPage: payload.next,
    previousPage: payload.previous,
    items: payload.results.map(mapPokemonListItem),
  };
}

export const getAllPokemon = cache(async (): Promise<PokemonDirectory> => {
  const response = await fetch(getPokemonApiUrl(), {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: REVALIDATE_INTERVAL_IN_SECONDS,
    },
  });

  if (!response.ok) {
    throw new Error(`PokeAPI request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;
  return mapPokemonListResponse(payload);
});
