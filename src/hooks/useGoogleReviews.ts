import { useEffect, useState } from 'react';

declare global {
  interface Window {
    google: any;
    __googleMapsReady: Promise<void>;
    __googleMapsResolve: () => void;
    initGoogleMaps: () => void;
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
const PLACE_LAT = 18.5999023;
const PLACE_LNG = 73.7700584;

export const useGoogleReviews = () => {
  const [data, setData] = useState<GooglePlaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        await window.__googleMapsReady;
        if (cancelled) return;

        // Create a hidden div to satisfy PlacesService requirement
        const mapDiv = document.createElement('div');
        mapDiv.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
        document.body.appendChild(mapDiv);

        const map = new window.google.maps.Map(mapDiv, {
          center: { lat: PLACE_LAT, lng: PLACE_LNG },
          zoom: 15,
        });

        const service = new window.google.maps.places.PlacesService(map);

        service.findPlaceFromQuery(
          {
            query: PLACE_NAME,
            fields: ['place_id'],
            locationBias: { lat: PLACE_LAT, lng: PLACE_LNG },
          },
          (results: any[], status: string) => {
            if (cancelled) return;

            if (
              status !== window.google.maps.places.PlacesServiceStatus.OK ||
              !results?.[0]
            ) {
              setError('Place not found');
              setLoading(false);
              document.body.removeChild(mapDiv);
              return;
            }

            service.getDetails(
              {
                placeId: results[0].place_id,
                fields: ['reviews', 'rating', 'user_ratings_total'],
              },
              (place: any, detailStatus: string) => {
                if (cancelled) return;
                document.body.removeChild(mapDiv);

                if (detailStatus === window.google.maps.places.PlacesServiceStatus.OK) {
                  setData({
                    reviews: place.reviews || [],
                    rating: place.rating ?? 0,
                    user_ratings_total: place.user_ratings_total ?? 0,
                  });
                } else {
                  setError('Could not fetch reviews');
                }
                setLoading(false);
              }
            );
          }
        );
      } catch {
        if (!cancelled) {
          setError('Google Maps failed to load');
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
};
