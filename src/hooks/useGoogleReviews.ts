import { useEffect, useState } from 'react';

declare global {
  interface Window {
    google: any;
    __googleMapsReady: Promise<void>;
    __googleMapsResolve: () => void;
    __googleMapsReject: (err: Error) => void;
    initGoogleMaps: () => void;
    gm_authFailure: () => void;
  }
}

export interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  relative_time_description: string;
  profile_photo_url: string;
  time: number;
}

export interface GooglePlaceData {
  reviews: GoogleReview[];
  rating: number;
  user_ratings_total: number;
}

const PLACE_NAME = 'Crunch Fitness Club';
const PLACE_LAT  = 18.5999023;
const PLACE_LNG  = 73.7700584;

// Race the Maps-ready promise against a 10 s timeout so we never hang forever
function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return Promise.race([
    promise,
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Google Maps load timed out')), ms)
    ),
  ]);
}

export const useGoogleReviews = () => {
  const [data, setData]       = useState<GooglePlaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // Will reject if gm_authFailure fires OR times out after 10 s
        await withTimeout(window.__googleMapsReady, 10_000);
        if (cancelled) return;

        // `libraries=places` is in the script URL so Place is already on the namespace
        const Place = window.google.maps.places.Place;

        const { places } = await Place.searchByText({
          textQuery: PLACE_NAME,
          fields: ['id', 'rating', 'userRatingCount', 'reviews'],
          locationBias: { lat: PLACE_LAT, lng: PLACE_LNG },
          maxResultCount: 1,
        });

        if (cancelled) return;

        if (!places?.length) {
          setError('Place not found');
          return;
        }

        const place = places[0];
        // Fetch full fields (reviews need an extra round-trip in the new API)
        await place.fetchFields({ fields: ['reviews', 'rating', 'userRatingCount'] });
        if (cancelled) return;

        const reviews: GoogleReview[] = (place.reviews ?? []).map((r: any) => ({
          author_name:               r.authorAttribution?.displayName ?? 'Anonymous',
          rating:                    r.rating ?? 5,
          text:                      r.text?.text ?? r.text ?? '',
          relative_time_description: r.relativePublishTimeDescription ?? '',
          profile_photo_url:         r.authorAttribution?.photoURI ?? '',
          time:                      r.publishTime instanceof Date ? r.publishTime.getTime() : 0,
        }));

        setData({
          reviews,
          rating:             place.rating ?? 0,
          user_ratings_total: place.userRatingCount ?? 0,
        });
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Google Maps failed to load';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
};
