import type { AppConfig } from "../config.js";
import { MOCK_HOTEL_FRONTIER_DAYS } from "../domain/horizons.js";
import { DuffelFlightProvider } from "./duffel/duffelFlightProvider.js";
import { DuffelHotelProvider } from "./duffel/duffelHotelProvider.js";
import { MockFlightProvider } from "./mock/mockFlightProvider.js";
import { MockHotelProvider } from "./mock/mockHotelProvider.js";
import { TravelpayoutsFlightProvider } from "./travelpayouts/travelpayoutsFlightProvider.js";
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

/**
 * Production registry: mock adapters always present but yield (become
 * disabled) once the activation gate opens, so active*Provider() naturally
 * picks a real adapter. Real adapters stay disabled until REAL_PROVIDERS_ENABLED
 * and any per-provider access flag are set; while disabled the app keeps using
 * mock and calling a real adapter throws ACCESS_NOT_CONFIGURED.
 */
export function createRegistry(config: AppConfig): ProviderRegistry {
  const realFlightActive =
    config.realProvidersEnabled && (config.travelpayoutsToken != null || config.duffelToken != null);
  const mockEnabled = !realFlightActive;
  const flightProviders: FlightProvider[] = [new MockFlightProvider(mockEnabled)];
  const hotelProviders: HotelProvider[] = [new MockHotelProvider(config.mockHotelFrontierDays, mockEnabled)];
  if (config.travelpayoutsToken) {
    flightProviders.push(new TravelpayoutsFlightProvider(config));
  }
  if (config.duffelToken) {
    flightProviders.push(new DuffelFlightProvider(config));
    hotelProviders.push(new DuffelHotelProvider(config));
  }
  return { flightProviders, hotelProviders };
}

/** First enabled provider, falling back to the mock adapter at index 0. */
export function activeFlightProvider(registry: ProviderRegistry): FlightProvider {
  return registry.flightProviders.find((p) => p.enabled) ?? (registry.flightProviders[0] as FlightProvider);
}

export function activeHotelProvider(registry: ProviderRegistry): HotelProvider {
  return registry.hotelProviders.find((p) => p.enabled) ?? (registry.hotelProviders[0] as HotelProvider);
}

export async function collectHealth(registry: ProviderRegistry): Promise<ProviderHealthSnapshot[]> {
  const flights = await Promise.all(registry.flightProviders.map((p) => p.health()));
  const hotels = await Promise.all(registry.hotelProviders.map((p) => p.health()));
  return [...flights, ...hotels];
}
