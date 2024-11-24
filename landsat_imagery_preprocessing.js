var studyAreaUG = ee.FeatureCollection("projects/ee-phd-aston/assets/boundaryDatasets/UGA_adm0"),
    lc9_c2_t2 = ee.ImageCollection("LANDSAT/LC09/C02/T2_L2"),
    lc8_c2_t2 = ee.ImageCollection("LANDSAT/LC08/C02/T2_L2");
	
//Common symbology parameters for Display of study area and other data
var vis_params = { 'lineType': 'solid', 'fillColor': '00000000', }
var lc_palette = ['006633', 'E5FFCC', '662A00', 'D8D8D8', 'F5F5F5']

studyAreaPilot = studyAreaUG
Map.addLayer(studyAreaPilot.style(vis_params), {}, "Pilot Study Area");
Map.centerObject(studyAreaPilot, 8);

//satellite imagery filtered to parameters of interest 
var lc_bands = ["SR_B2","SR_B3","SR_B4","SR_B5"];
var indices_bands =['NDVI'];

// Define Landsat 8 and Landsat 9 collections
var lc8 = lc8_c2_t2;
var lc9 = lc9_c2_t2;

// Define the years of interest
var years = [2015, 2017, 2020, 2022, 2024];

// Function to filter, calculate NDVI, and mosaic for a given year
var processYear = function(year) {
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = ee.Date.fromYMD(year, 12, 31);
  
  // Filter Landsat 8 data for the year
  var yearCollection = lc8.filterDate(startDate, endDate).select(lc_bands);
  
  // Check if Landsat 8 data is available (else use Landsat 9)
  var count = yearCollection.size().getInfo();
  print('Count Value', count);
  
  if (count === 0) {
    print('Using Landsat 9 instead for year', year);
    yearCollection = lc9.filterDate(startDate, endDate).select(lc_bands);
  } else {
    print('Using Landsat 8 data for year', year);
  }
  
  // Calculate NDVI for the collection
  var calcNDVI = function(image) {
    var formula = '(NIR-RED)/(NIR+RED)';
    return image.addBands(image.expression({
      expression: formula,
      map: {
        NIR: image.select('SR_B5').multiply(0.0001),
        RED: image.select('SR_B4').multiply(0.0001)
      }
    }).rename('NDVI'));
  };
  
  var yearWithNDVI = yearCollection.map(calcNDVI);
  
  // Create a mosaicked image for the year
  //var mosaickedImage = yearWithNDVI.median(); // Use median to mosaic
  var mosaickedImage = yearWithNDVI.qualityMosaic('NDVI'); // Use quality mozaic to mosaic
  print("Mosaicked Image for Year", year, mosaickedImage);
  
   // Cast NDVI to uint16 to match the other bands' data format
  mosaickedImage = mosaickedImage.select('NDVI').multiply(10000).uint16()
    .addBands(mosaickedImage.select(lc_bands));
  
  // Set a property to identify the year for export
  mosaickedImage = mosaickedImage.set('year', year);
  
  // Return the mosaicked image
  return mosaickedImage;
};

// Process each year and store results in a list
var yearlyMosaics = years.map(function(year) {
  return processYear(year);
});

// Export each year's mosaicked image to Assets
yearlyMosaics.forEach(function(image, index) {
  var year = years[index];
  Export.image.toAsset({
    image: ee.Image(image),
    description: 'MOSAICS_' + year,
    assetId: 'LANDSAT_MOSAIC/MOSAICS_' + year,
    crs:  'EPSG:4326',
    scale: 30,
    region: studyAreaPilot.geometry(),
    maxPixels: 1e13
  });
});