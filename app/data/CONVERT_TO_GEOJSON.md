# Convert Shapefile to GeoJSON

You downloaded the **shapefile** version, but the map needs **GeoJSON**.

## Option 1: Download GeoJSON Directly (EASIEST)

1. Go back to: https://www.naturalearthdata.com/downloads/110m-cultural-vectors/
2. Look for a **GeoJSON** download option (not shapefile)
3. OR use this direct link:
   - https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson
   - Save as `world.geojson` in `app/data/`

## Option 2: Convert Shapefile to GeoJSON

If you want to use the files you already have, you need to convert them:

### Using QGIS (Free Software)
1. Download QGIS: https://qgis.org/
2. Open QGIS
3. Layer → Add Vector Layer → Select `ne_110m_admin_0_countries.shp`
4. Right-click layer → Export → Save Features As
5. Format: GeoJSON
6. Save to `app/data/ne_110m_admin_0_countries.geojson`

### Using Online Converter
1. Go to: https://mapshaper.org/
2. Drag & drop all the shapefile files (.shp, .shx, .dbf, .prj)
3. Click "Export" → Choose "GeoJSON"
4. Download and save to `app/data/ne_110m_admin_0_countries.geojson`

### Using Python (if you have it)
```bash
pip install geopandas
python -c "import geopandas as gpd; gdf = gpd.read_file('ne_110m_admin_0_countries.shp'); gdf.to_file('ne_110m_admin_0_countries.geojson', driver='GeoJSON')"
```

## Recommended: Just Download GeoJSON

Easiest is to just download the GeoJSON version directly - no conversion needed!
