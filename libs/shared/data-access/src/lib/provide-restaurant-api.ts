import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { DummyRestaurantApi } from './dummy/dummy-restaurant-api';
import { RestaurantApi } from './restaurant-api';

/**
 * Binds the RestaurantApi used by every app. Dummy data for now; switch this one place to the
 * HTTP + SignalR implementation when the .NET API is available.
 */
export function provideRestaurantApi(): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: RestaurantApi, useClass: DummyRestaurantApi }]);
}
