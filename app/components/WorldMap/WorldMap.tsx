'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGameStore } from '@/app/store/gameStore';
import { getInfectionColor } from '@/app/utils/infectionColors';
import { REGION_ISOS, REGIONS } from '@/app/utils/regionData';

// Natural Earth GeoJSON with proper country properties
const COUNTRIES_GEOJSON_URL =
  'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson';

// Map country names to ISO codes
const countryNameToIso: Record<string, string> = {
  'United States': 'US',
  'United States of America': 'US',
  'Canada': 'CA',
  'Brazil': 'BR',
  'Argentina': 'AR',
  'United Kingdom': 'GB',
  'France': 'FR',
  'Germany': 'DE',
  'Russia': 'RU',
  'China': 'CN',
  'India': 'IN',
  'Australia': 'AU',
  'Japan': 'JP',
  'Nigeria': 'NG',
  'South Africa': 'ZA',
  'Egypt': 'EG',
  'Saudi Arabia': 'SA',
  'Pakistan': 'PK',
  'Indonesia': 'ID',
  'Turkey': 'TR',
  'Mexico': 'MX',
};

interface WorldMapProps {
  onRegionClick?: (iso: string) => void;
}

export default function WorldMap({ onRegionClick }: WorldMapProps) {
  const { infectionData, selectedRegion, selectRegion } = useGameStore();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const selectedLayerRef = useRef<L.Path | null>(null);

  // Helper to get ISO from feature properties
  const getIsoFromFeature = (feature: any): string | null => {
    if (!feature || !feature.properties) return null;
    
    const props = feature.properties;
    
    // Try ISO codes first
    let iso = props.ISO_A2 
      || props.iso_a2 
      || props.ISO_A2_EH
      || props.ISO_A2_CD
      || props.ADM0_A3;
    
    // If no ISO, try country name
    if (!iso && props.name) {
      iso = countryNameToIso[props.name] || null;
    }
    
    // Try NAME property
    if (!iso && props.NAME) {
      iso = countryNameToIso[props.NAME] || null;
    }
    
    return iso || null;
  };

  // Helper to convert RGBA array to hex color
  const rgbaToHex = (rgba: [number, number, number, number]): string => {
    const [r, g, b] = rgba;
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map with pan limits
    const map = L.map(mapContainerRef.current, {
      center: [20, 20],
      zoom: 2,
      zoomControl: false,
      attributionControl: false,
      minZoom: 2,
      maxZoom: 4,
      doubleClickZoom: false,
      scrollWheelZoom: true,
      dragging: true,
      preferCanvas: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      maxBounds: [
        [-85, -180], // Southwest corner
        [85, 180]    // Northeast corner
      ],
      maxBoundsViscosity: 1.0, // Prevent panning beyond bounds
    });

    // Set map container and all panes to pure black
    if (mapContainerRef.current) {
      mapContainerRef.current.style.backgroundColor = '#000000';
    }
    
    // Set all map panes to black background
    const mapPane = map.getPane('mapPane');
    if (mapPane) {
      mapPane.style.backgroundColor = '#000000';
    }
    
    const tilePane = map.getPane('tilePane');
    if (tilePane) {
      tilePane.style.backgroundColor = '#000000';
    }
    
    // Don't add any tile layer - just use pure black background

    // Force full screen
    const forceFullScreen = () => {
      if (mapContainerRef.current) {
        mapContainerRef.current.style.width = '100%';
        mapContainerRef.current.style.height = '100%';
        map.invalidateSize();
      }
    };

    forceFullScreen();
    window.addEventListener('resize', forceFullScreen);

    mapRef.current = map;

    // Load and add country polygons
    map.whenReady(() => {
      // Ensure map is fully initialized
      if (!map || !map.getContainer()) {
        console.error('Map not ready');
        return;
      }

      fetch(COUNTRIES_GEOJSON_URL)
        .then((res) => res.json())
        .then((geojson) => {
          // Double-check map is still valid
          if (!mapRef.current || !mapRef.current.getContainer()) {
            console.error('Map was removed before GeoJSON could be added');
            return;
          }

          // Get current store state for initial styling
          const currentInfectionData = useGameStore.getState().infectionData;
          const currentSelectedRegion = useGameStore.getState().selectedRegion;
          
          const geoJsonLayer = L.geoJSON(geojson, {
            style: (feature) => {
              const iso = getIsoFromFeature(feature);
              const isActiveRegion = iso && REGION_ISOS.includes(iso as typeof REGION_ISOS[number]);
              
              // Get infection color for active regions
              if (isActiveRegion && iso) {
                const pct = currentInfectionData[iso] ?? 0;
                const color = getInfectionColor(pct);
                return {
                  color: currentSelectedRegion === iso ? '#00aa55' : '#ffffff',
                  weight: currentSelectedRegion === iso ? 3 : 1,
                  fillColor: rgbaToHex(color),
                  fillOpacity: color[3] / 255,
                  opacity: 1,
                };
              }
              
              // Non-active regions: very dark green
              return {
                color: '#ffffff',
                weight: 1,
                fillColor: '#030a07',
                fillOpacity: 1,
                opacity: 0.8,
              };
            },
            onEachFeature: (feature, layer) => {
              const iso = getIsoFromFeature(feature);
              const countryName = feature.properties?.name || feature.properties?.NAME || 'Unknown';
              
              // Add hover effect
              layer.on({
                mouseover: (e) => {
                  const layer = e.target;
                  if (layer !== selectedLayerRef.current) {
                    layer.setStyle({
                      weight: 2,
                      opacity: 1,
                    });
                  }
                  layer.bringToFront();
                },
                mouseout: (e) => {
                  const layer = e.target;
                  if (layer !== selectedLayerRef.current) {
                    const iso = getIsoFromFeature(feature);
                    const isActiveRegion = iso && REGION_ISOS.includes(iso as typeof REGION_ISOS[number]);
                    
                    if (isActiveRegion && iso) {
                      const pct = infectionData[iso] ?? 0;
                      const color = getInfectionColor(pct);
                      layer.setStyle({
                        color: selectedRegion === iso ? '#00aa55' : '#ffffff',
                        weight: selectedRegion === iso ? 3 : 1,
                        fillColor: rgbaToHex(color),
                        fillOpacity: color[3] / 255,
                        opacity: 1,
                      });
                    } else {
                      layer.setStyle({
                        color: '#ffffff',
                        weight: 1,
                        fillColor: '#030a07',
                        fillOpacity: 1,
                        opacity: 0.8,
                      });
                    }
                  }
                },
                click: (e) => {
                  const layer = e.target;
                  
                  if (!iso) return;
                  
                  // Reset previous selection
                  if (selectedLayerRef.current && selectedLayerRef.current !== layer) {
                    const prevFeature = (selectedLayerRef.current as any).feature;
                    const prevIso = getIsoFromFeature(prevFeature);
                    if (prevIso && REGION_ISOS.includes(prevIso as typeof REGION_ISOS[number])) {
                      const prevPct = infectionData[prevIso] ?? 0;
                      const prevColor = getInfectionColor(prevPct);
                      selectedLayerRef.current.setStyle({
                        color: '#ffffff',
                        weight: 1,
                        fillColor: rgbaToHex(prevColor),
                        fillOpacity: prevColor[3] / 255,
                        opacity: 1,
                      });
                    } else {
                      selectedLayerRef.current.setStyle({
                        color: '#ffffff',
                        weight: 1,
                        fillColor: '#030a07',
                        fillOpacity: 1,
                        opacity: 0.8,
                      });
                    }
                  }
                  
                  // Select new country
                  selectRegion(iso);
                  
                  if (iso && REGION_ISOS.includes(iso as typeof REGION_ISOS[number])) {
                    const pct = infectionData[iso] ?? 0;
                    const color = getInfectionColor(pct);
                    layer.setStyle({
                      color: '#00aa55',
                      weight: 3,
                      fillColor: rgbaToHex(color),
                      fillOpacity: color[3] / 255,
                      opacity: 1,
                    });
                    selectedLayerRef.current = layer;
                    
                    // Trigger callback
                    if (onRegionClick) {
                      onRegionClick(iso);
                    }
                  } else {
                    layer.setStyle({
                      color: '#00aa55',
                      weight: 3,
                      fillColor: '#030a07',
                      fillOpacity: 1,
                      opacity: 1,
                    });
                    selectedLayerRef.current = layer;
                  }
                },
              });
              
              // Store feature reference on layer for later access
              (layer as any).feature = feature;
            },
          });

          // Use mapRef.current to ensure we have the latest map reference
          if (mapRef.current && mapRef.current.getContainer()) {
            geoJsonLayer.addTo(mapRef.current);
            geoJsonLayerRef.current = geoJsonLayer;
          } else {
            console.error('Cannot add GeoJSON layer: map container not available');
          }
        })
        .catch((error) => {
          console.error('Error loading GeoJSON:', error);
        });
    });

    return () => {
      window.removeEventListener('resize', forceFullScreen);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      geoJsonLayerRef.current = null;
      selectedLayerRef.current = null;
    };
  }, []);

  // Update map styles when infection data or selection changes
  useEffect(() => {
    if (!geoJsonLayerRef.current) return;

    geoJsonLayerRef.current.eachLayer((layer) => {
      const feature = (layer as any).feature;
      if (!feature) return;

      const iso = getIsoFromFeature(feature);
      const isActiveRegion = iso && REGION_ISOS.includes(iso as typeof REGION_ISOS[number]);

      if (isActiveRegion && iso) {
        const pct = infectionData[iso] ?? 0;
        const color = getInfectionColor(pct);
        const isSelected = selectedRegion === iso;

        // Don't update if this is the currently selected layer (handled by click)
        if ((layer as L.Path) !== selectedLayerRef.current) {
          (layer as L.Path).setStyle({
            color: isSelected ? '#00aa55' : '#ffffff',
            weight: isSelected ? 3 : 1,
            fillColor: rgbaToHex(color),
            fillOpacity: color[3] / 255,
            opacity: 1,
          });
        }
      } else {
        // Non-active regions
        if ((layer as L.Path) !== selectedLayerRef.current) {
          (layer as L.Path).setStyle({
            color: '#ffffff',
            weight: 1,
            fillColor: '#030a07',
            fillOpacity: 1,
            opacity: 0.8,
          });
        }
      }
    });
  }, [infectionData, selectedRegion]);

  return (
    <div 
      ref={mapContainerRef}
      className="absolute inset-0 w-full h-full z-0 bg-black"
      style={{
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        backgroundColor: '#000000',
      }}
    />
  );
}
