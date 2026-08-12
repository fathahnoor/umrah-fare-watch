import { MOCK_HOTEL_FRONTIER_DAYS } from "../domain/horizons.js";
import { MockFlightProvider } from "./mock/mockFlightProvider.js";
import { MockHotelProvider } from "./mock/mockHotelProvider.js";
import type { FlightProvider, HotelProvider, ProviderHealthSnapshot } from "./types.js";

export interface ProviderRegistry {
  flightProviders: FlightProvider[];
  hotelProviders: HotelProvider[];
}

export function createMockRegistry(hotelFrontierDays: number = MOCK_HOTEL_FRONTIER_DAYS): ProviderRegistry {
  return {
    flightProviders: [new MockFlightProvider()],
    hotelProviders: [new MockHotelProvider(hotelFrontierDays)],
  };
}

export async function collectHealth(registry: ProviderRegistry): Promise<ProviderHealthSnapshot[]> {
  const flights = await Promise.all(registry.flightProviders.map((p) => p.health()));
  const hotels = await Promise.all(registry.hotelProviders.map((p) => p.health()));
  return [...flights, ...hotels];
}
