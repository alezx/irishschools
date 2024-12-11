import './style.css';

/* OpenLayers */
import {Map, View, Overlay} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import {fromLonLat} from 'ol/proj';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import {Circle, Fill, Icon, Stroke, Style, Text} from 'ol/style.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';

/* Bootstrap */
import * as bootstrap from 'bootstrap'


// CODE


/* load percentages*/
const SPLIT_REGEX = /[ ,]+/
const excludedWords = new Set(['College', 'Community', 'School', 'Secondary', 'School', 'St', 'Road']);
const percentagesFile = await fetch('data/percentages.json');
const percentages = await percentagesFile.json();

for (let i = 0; i < percentages.length; i++) {
    let entry = percentages[i];
    try {
      entry.tokens = new Set(entry.schoolName.split(SPLIT_REGEX)).difference(excludedWords);
    } catch (e) {
      console.warn('error', e);
    }
}


// finds percents of students matching the percentaged.json file (by school name)
// stores the percent in the school (side effect)
let findPerchentage = function (school) {
  school['matchedPercent23'] = '0';
  school['matchedPercent22'] = '0';
  let max = 0; // what tokens are matching most
  try {
    let tokens = new Set(school.name.split(SPLIT_REGEX));
    tokens = tokens.union(new Set(school.address1.split(SPLIT_REGEX)));
    tokens = tokens.union(new Set(school.address2.split(SPLIT_REGEX)));
    tokens = tokens.difference(excludedWords);
    for (let i = 0; i < percentages.length; i++) {
      let entry = percentages[i];
      let intersect = tokens.intersection(entry.tokens);
      if (intersect.size > max) {
        max = intersect.size;
        school['matchedPercentSchoolName'] = entry.schoolName;
        school['matchedPercent23'] = `${entry.toThirdLevel2023 * 100}%`;
        school['matchedPercent22'] = `${entry.toThirdLevel2022 * 100}%`;
      }
    }
  } catch (e) {
    console.warn('error with school ', e);
  }
  return school['matchedPercent23'];
};

const map = new Map({
  target: document.getElementById('map'),
  layers: [
    new TileLayer({
        source: new OSM()
    })
  ],
  view: new View({
    center: fromLonLat([-6.176945008064694, 53.27304905]),
    zoom: 11
  })
});



/* load secondary schools */
const schoolsFile = await fetch('data/secondary-schools.json');
const secSchools = await schoolsFile.json();

var secondarySchoolMarkers = new VectorLayer({
  source: new VectorSource(),
  style: function(feature, resolution) {
    let styles = [];
    let school = feature.get('school');
    styles.push(new Style({
      image: new Icon({
        anchor: [0.5, 1],
        src: school.schoolGenderPostPrimary == "Girls" ? 
          'resources/school-girls.png' : 
          school.schoolGenderPostPrimary == "Boys" ? 
          'resources/school-boys.png' : 'resources/school-mix.png'
      })
    }));
    if (school.feePayingSchoolYn == 'Y') {
      styles.push(new Style({
        image: new Icon({
          anchor: [0, 1],
          src: 'resources/dollar.png'
        })
      }));
    }
    if (school.ethosreligion == 'CATHOLIC') {
      styles.push(new Style({
        image: new Icon({
          anchor: [0.5, 3],
          src: 'resources/cross.png'
        })
      }));
    }
    styles.push(new Style({
        text: new Text({
          text: findPerchentage(school),
          offsetX: -20,
          offsetY: -8,
          font: '14px Calibri,sans-serif',
          fill: new Fill({
            color: 'black',
          }),
          stroke: new Stroke({
            color: 'white',
            width: 2,
          })
        })
    }));
    return styles; 
  }
});
map.addLayer(secondarySchoolMarkers);

for (let i = 0; i < secSchools.length; i++) {
  let school = secSchools[i];
  if (school.county != 'Dublin' && school.county != 'Wicklow') {
    continue;
  }
  let marker = new Feature({
    geometry: new Point(fromLonLat([school.schoolLongitude, school.schoolLatitude])),
    name: school.name,
    school: school
  });
  secondarySchoolMarkers.getSource().addFeature(marker);
}


/* load primary schools */
const pSchoolsFile = await fetch('data/primary-schools.json');
const pSchools = await pSchoolsFile.json();
var primarySchoolMarkers = new VectorLayer({
  source: new VectorSource(),
  style: function(feature, resolution) {
    let styles = [];
    let school = feature.get('school');
    styles.push(new Style({
      image: new Icon({
        anchor: [0.5, 1],
        scale: 0.8,
        src: 'resources/primary-school.png'
      })
    }));
    if (school.feePayingSchoolYn == 'Y') {
      styles.push(new Style({
        image: new Icon({
          anchor: [0, 1],
          src: 'resources/dollar.png'
        })
      }));
    }
    if (school.ethosDescription == 'Catholic') {
      styles.push(new Style({
        image: new Icon({
          anchor: [0.5, 2.5],
          src: 'resources/cross.png'
        })
      }));
    }
    return styles; 
  }
});
map.addLayer(primarySchoolMarkers);

for (let i = 0; i < pSchools.length; i++) {
  let school = pSchools[i];
  school.name = school.officialName;
  if (school.countyDescription != 'Dublin' && school.countyDescription != 'Wicklow') {
    continue;
  }
  let marker = new Feature({
    geometry: new Point(fromLonLat([school.schoolLongitude, school.schoolLatitude])),
    name: school.officialName,
    school: school
  });
  primarySchoolMarkers.getSource().addFeature(marker);
}



/* PopUp */
const element = document.getElementById('popup');
const popup = new Overlay({
  element: element,
  positioning: 'bottom-center',
  stopEvent: false,
});
map.addOverlay(popup);

let popover;
function disposePopover() {
  if (popover) {
    popover.dispose();
    popover = undefined;
  }
}
// display popup on click
map.on('click', function (evt) {
  const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
    return feature;
  });
  disposePopover();
  if (!feature) {
    return;
  }
  popup.setPosition(evt.coordinate);
  popover = new bootstrap.Popover(element, {
    customClass: 'school-popover',
    placement: 'top',
    html: true,
    //content: feature.get('name'),
    content: function() {
      //return document.getElementById("school_popup").getElementsByClassName("popover-body")[0].innerHTML;
      let html = '<div>';
      for (const [key, value] of Object.entries(feature.get('school'))) {
        html += `<strong>${key}</strong>: ${value}<br>`;
      }
      html+='</div>';
      return html;
    },
    title: function() {
      return '<strong>'+feature.get('school').name+'</strong>';
      //return document.getElementById("school_popup").getElementsByClassName("popover-title")[0].innerHTML;
    }
  });
  popover.show();
});

// change mouse cursor when over marker
map.on('pointermove', function (e) {
  const pixel = map.getEventPixel(e.originalEvent);
  const hit = map.hasFeatureAtPixel(pixel);
  map.getTarget().style.cursor = hit ? 'pointer' : '';
});
// Close the popup when the map is moved
map.on('movestart', disposePopover);