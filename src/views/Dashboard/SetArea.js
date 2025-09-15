import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Tag,
  TagLabel,
  TagCloseButton,
  VStack,
  useToast,
  Tooltip,
  Spinner,
} from "@chakra-ui/react";
import { MapContainer, TileLayer, FeatureGroup, useMap } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
window.L = L;
const API_BASE_URL = process.env.NODE_ENV === 'development' ? 'https://mutto-admin-api--mutto-84d97.asia-east1.hosted.app' : 'https://mutto-admin-api--mutto-84d97.asia-east1.hosted.app';

// --- Helper component to change map view or fit bounds ---
function MapView({ center, zoom, bounds }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    if (bounds) map.fitBounds(bounds);
    else if (center && zoom) map.setView(center, zoom);
  }, [center, zoom, bounds, map]);
  return null;
}

export default function SetArea({ isOpen, onClose, worker, onSave, loading }) {
  const toast = useToast();

  // --- State ---
  const [areas, setAreas] = useState([]);
  const [mapCenter, setMapCenter] = useState([24.4539, 54.3773]); // Default to Abu Dhabi
  const [mapZoom, setMapZoom] = useState(8);
  const [mapBounds, setMapBounds] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [place, setPlace] = useState(null);

  const [editingTag, setEditingTag] = useState({ id: null, name: "" });

  const featureGroupRef = useRef();
  const areaLayerMap = useRef({});
  const layerToAreaMap = useRef({});
  const clickTimeout = useRef(null);

  // --- Load worker service areas when modal opens ---
const [areasLoaded, setAreasLoaded] = useState(false);

useEffect(() => {
  if (!isOpen) return;

  setAreasLoaded(false); // reset before fetching

  const loadAreas = async () => {
    let initialAreas = [];

    if (worker?.serviceArea?.length) {
      initialAreas = worker.serviceArea.map((a, idx) => {
        const geometry = typeof a.geometry === "string" ? JSON.parse(a.geometry) : a.geometry;
        return {
          ...a,
          id: a.id || `area-${idx}-${Date.now()}`,
          geometry: geometry
        };
      });
    }

    setAreas(initialAreas);
    setTimeout(() => {
      if (initialAreas.length) fitAllAreas(initialAreas);
      else {
        setMapCenter([24.4539, 54.3773]);
        setMapZoom(8);
        setMapBounds(null);
      }
      setAreasLoaded(true); // ✅ now ready
    }, 200); // small delay so Leaflet initializes properly
  };

  loadAreas();
}, [isOpen, worker]);

  // --- Handle place selection from Google Autocomplete ---
  const handlePlaceSelect = async (selectedPlace) => {
    if (!selectedPlace || !selectedPlace.value) return;
    setSearchLoading(true);
    try {
      const googlePlaceId = selectedPlace.value.place_id;
      const res = await fetch(API_BASE_URL+`/api/googleToOsm?googlePlaceId=${googlePlaceId}`);
      const osmData = await res.json();

      if (!res.ok) {
        throw new Error(osmData.error || 'Failed to fetch OSM data.');
      }

      let geometryToUse = osmData.geojson;
      if (!geometryToUse) {
        // If no detailed GeoJSON, use a rough estimate circle
        const defaultRadius = 500; // meters, adjust as needed
        geometryToUse = {
          type: "Point",
          coordinates: [osmData.lon, osmData.lat], // GeoJSON format: [lng, lat]
          properties: { radius: defaultRadius }
        };
        toast({ title: "No detailed boundary found, using a circular estimate.", status: "info", position: "top-right" });
      }

      const newArea = {
        id: osmData.osm_id, // Use OSM ID for uniqueness
        name: osmData.display_name,
        geometry: geometryToUse,
      };

      setAreas((prev) => [...prev, newArea]);

    } catch (err) {
      console.error(err);
      toast({ title: "Error fetching area boundary", description: err.message, status: "error", position: "top-right" });
    } finally {
      setSearchLoading(false);
      setPlace(null); // Reset autocomplete input
    }
  };

  useEffect(() => {
    if (place) {
      handlePlaceSelect(place);
    }
  }, [place]);


  // --- Drawn shapes handlers ---
const handleCreated = (e) => {
  const { layerType, layer } = e;
  const now = Date.now();
  let newArea = null;

  if (layerType === "polygon")
    newArea = {
      id: `polygon-${now}`,
      name: `Drawn Polygon`,
      geometry: { type: "Polygon", coordinates: [layer.getLatLngs()[0].map(l => [l.lng, l.lat])] }
    };
  else if (layerType === "rectangle") {
    const b = layer.getBounds();
    newArea = {
      id: `rect-${now}`,
      name: `Drawn Rectangle`,
      geometry: {
        type: "Polygon",
        coordinates: [[
          [b.getSouthWest().lng, b.getSouthWest().lat],
          [b.getNorthEast().lng, b.getSouthWest().lat],
          [b.getNorthEast().lng, b.getNorthEast().lat],
          [b.getSouthWest().lng, b.getNorthEast().lat],
          [b.getSouthWest().lng, b.getSouthWest().lat]
        ]]
      }
    };
  } else if (layerType === "circle") {
    newArea = {
      id: `circle-${now}`,
      name: `Drawn Circle`,
      geometry: { type: "Point", coordinates: [layer.getLatLng().lng, layer.getLatLng().lat], properties: { radius: layer.getRadius() } }
    };
  }

  if (newArea) {
    setAreas(prev => [...prev, newArea]);
  }
};


  const handleEdited = (e) => {
    const updatedGeometries = {};
    e.layers.eachLayer((layer) => {
      const id = layerToAreaMap.current[layer._leaflet_id];
      if (!id) return;
      let geom = null;
      if (layer instanceof L.Polygon) geom = { type: "Polygon", coordinates: [layer.getLatLngs()[0].map(l => [l.lng, l.lat])] };
      else if (layer instanceof L.Circle) geom = { type: "Point", coordinates: [layer.getLatLng().lng, layer.getLatLng().lat], properties: { radius: layer.getRadius() } };
      if (geom) updatedGeometries[id] = geom;
    });
    if (Object.keys(updatedGeometries).length) {
      setAreas((prev) => prev.map((a) => (updatedGeometries[a.id] ? { ...a, geometry: updatedGeometries[a.id] } : a)));
      toast({ title: "Areas updated", status: "success", position: "top-right" });
    }
  };

  const handleDeleted = (e) => {
    const idsToDelete = [];
    e.layers.eachLayer((layer) => { if (layerToAreaMap.current[layer._leaflet_id]) idsToDelete.push(layerToAreaMap.current[layer._leaflet_id]); });
    if (idsToDelete.length) {
      setAreas((prev) => prev.filter((a) => !idsToDelete.includes(a.id)));
      toast({ title: "Areas removed", status: "info", position: "top-right" });
    }
  };

  // --- FeatureGroup layer management ---
useEffect(() => {
  let cancelled = false;
  let tries = 0;
  const maxTries = 20;

  const populate = () => {
    const fg = featureGroupRef.current;
    if (!fg) {
      // FeatureGroup not ready yet — try again a few times
      if (tries++ < maxTries && !cancelled) {
        setTimeout(populate, 100);
      }
      return;
    }

    // clear existing layers and rebuild from areas
    fg.clearLayers();
    areaLayerMap.current = {};
    layerToAreaMap.current = {};

    areas.forEach((a) => {
      try {
        if (!a?.geometry) return;
        let layer = null;
        const { type } = a.geometry;

        if (type === "Polygon") {
          // GeoJSON polygon -> Leaflet polygon (lat,lng)
          const coords = (a.geometry.coordinates[0] || []).map(c => [c[1], c[0]]);
          if (coords.length) layer = L.polygon(coords);
        } else if (type === "MultiPolygon") {
          // flatten first ring(s)
          const coords = (a.geometry.coordinates || []).flatMap(p => (p[0] || []).map(c => [c[1], c[0]]));
          if (coords.length) layer = L.polygon(coords);
        } else if (type === "Point") {
          const lat = a.geometry.coordinates[1];
          const lng = a.geometry.coordinates[0];
          if (a.geometry.properties?.isCustomMarker) layer = L.marker([lat, lng]);
          else layer = L.circle([lat, lng], { radius: a.geometry.properties?.radius || 1000 });
        }

        if (layer) {
          fg.addLayer(layer);
          areaLayerMap.current[a.id] = layer._leaflet_id;
          layerToAreaMap.current[layer._leaflet_id] = a.id;
        }
      } catch (err) {
        console.error("Failed to add area layer", err, a);
      }
    });

    
  };

  // only populate when we believe areas are loaded (your areasLoaded flag)
  if (areasLoaded) populate();

  return () => { cancelled = true; };
}, [areasLoaded, areas]);



  // --- Tag Actions ---
const handleTagClick = (area) => {
  if (clickTimeout.current) {
    clearTimeout(clickTimeout.current);
    clickTimeout.current = null;
    setEditingTag({ id: area.id, name: area.name || "" });
  } else {
    clickTimeout.current = setTimeout(() => {
      clickTimeout.current = null;
      const layerId = areaLayerMap.current[area.id];
      if (layerId && featureGroupRef.current) {
        const layer = featureGroupRef.current.getLayer(layerId);
        if (layer) {
          // Focus the map on the shape
          if (layer.getBounds) setMapBounds(layer.getBounds());
          else if (layer.getLatLng) {
            setMapCenter(layer.getLatLng());
            setMapZoom(14);
          }

          // Enable edit handles on this layer
          if (layer.editing) layer.editing.enable();

          // 🔥 Also activate the edit toolbar so Save/Cancel shows up
          if (featureGroupRef.current._map && featureGroupRef.current._map.editTools) {
            // For leaflet-draw
            const drawControl = featureGroupRef.current._map._controlContainer?.querySelector('.leaflet-draw-edit-edit');
            if (drawControl) {
              drawControl.click(); // simulate user clicking the "Edit" button
            }
          }
        }
      }
    }, 250);
  }
};


  const renameTag = (id) => {
    if (!editingTag.name.trim()) return toast({ title: "Tag name cannot be empty", status: "warning" });
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, name: editingTag.name.trim() } : a)));
    setEditingTag({ id: null, name: "" });
  };

  const removeArea = (id) => setAreas((prev) => prev.filter((a) => a.id !== id));

  // --- Fit all areas ---
  const fitAllAreas = (areaList = areas) => {
    if (!areaList.length) return;
    const allCoords = areaList.flatMap((a) => {
      if (a.geometry.type === "Polygon") return a.geometry.coordinates[0];
      if (a.geometry.type === "MultiPolygon") return a.geometry.coordinates.flatMap(p => p[0]);
      if (a.geometry.type === "Point") {
        const center = L.latLng(a.geometry.coordinates[1], a.geometry.coordinates[0]);
        const radius = a.geometry.properties?.radius || 1000;
        const bounds = center.toBounds(radius);
        return [[bounds.getSouthWest().lng, bounds.getSouthWest().lat], [bounds.getNorthEast().lng, bounds.getNorthEast().lat]];
      }
      return [];
    });
    if (allCoords.length) setMapBounds(L.latLngBounds(allCoords.map(c => [c[1], c[0]])));
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Set Worker Service Area</ModalHeader>
          <ModalCloseButton />
          <ModalBody p={4}>
            <VStack spacing={4} align="stretch">
              <Box>
                <Flex justify="space-between" align="flex-start" gap={4}>
                  <FormControl id="area-search">
                    <FormLabel>Search for an Area</FormLabel>
                    <Box position="relative" zIndex={1001}>
                       <GooglePlacesAutocomplete
                          apiKey={"AIzaSyAcaEIbX_s-ZYhEkBbwKQBLuuX2GTBGISs"}
                          selectProps={{
                            value: place,
                            onChange: setPlace,
                            placeholder: "Search for an area...",
                            styles: { menu: (base) => ({ ...base, zIndex: 1002 }) },
                          }}
                        />
                       {searchLoading && <Spinner size="sm" position="absolute" top={2} right={2} zIndex={1003}/>}
                    </Box>
                  </FormControl>
                  <Button onClick={() => fitAllAreas()} mt={8}>Fit All</Button>
                </Flex>
                <Flex wrap="wrap" gap={2} mt={4}>
                  {areas.map((a) => (
                    <Tooltip key={a.id} label="Click to edit shape, double-click to rename." placement="top" hasArrow>
                      <Tag size="md" borderRadius="full" variant="solid" colorScheme={a.geometry.properties?.isCustomMarker ? "blue" : "orange"} cursor="pointer" onClick={() => handleTagClick(a)}>
                        {editingTag.id === a.id ? (
                          <Input size="xs" variant="unstyled" value={editingTag.name} onChange={(e) => setEditingTag(p => ({ ...p, name: e.target.value }))} onBlur={() => renameTag(a.id)} onKeyDown={(e) => e.key === "Enter" && renameTag(a.id)} autoFocus />
                        ) : <TagLabel>{a.name || "Unnamed Area"}</TagLabel>}
                        <TagCloseButton onClick={(e) => { e.stopPropagation(); removeArea(a.id); }} />
                      </Tag>
                    </Tooltip>
                  ))}
                </Flex>
              </Box>
              <Box w="100%" h="50vh" bg="gray.100">
           <Box w="100%" h="50vh" bg="gray.100">
  {!areasLoaded ? (
    <Flex align="center" justify="center" h="100%">
      <Spinner size="lg" />
    </Flex>
  ) : (
    <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: "100%", width: "100%" }}>
      <MapView center={mapCenter} zoom={mapZoom} bounds={mapBounds} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <FeatureGroup ref={featureGroupRef}>
        <EditControl
          position="topright"
          onCreated={handleCreated}
          onEdited={handleEdited}
          onDeleted={handleDeleted}
          draw={{ rectangle: true, circle: true, polygon: true, marker: false, polyline: false, circlemarker: false }}
          edit={{ edit: true, remove: false }}
        />
      </FeatureGroup>
    </MapContainer>
  )}
</Box>

              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button
  colorScheme="orange"
  isLoading={loading}
    onClick={() =>
    onSave(
      areas.map(a => ({
        ...a,
        geometry: JSON.stringify(a.geometry) // 👈 flatten nested arrays
      }))
    )
  }
>
  Save Areas
</Button>

          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
