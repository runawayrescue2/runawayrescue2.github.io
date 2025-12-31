// app.js
// API configuration (demo key). Move to server for production.
const httpApiUrl = "https://api.rescuegroups.org/http/v2.json";
const apiKey = "tHFlqnHF";

// Build animal search payload (postal code + radius)
function getAnimalData(postalCode, distance) {
  return {
    apikey: apiKey,
    objectType: "animals",
    objectAction: "publicSearch",
    search: {
      calcFoundRows: "Yes",
      resultStart: 0,
      resultLimit: 40,
      resultSort: "animalID",
      fields: [
        "animalID","animalOrgID","animalName","animalSpecies","animalBreed",
        "animalPictures","animalThumbnailUrl","animalLocationCitystate","fosterEmail","animalAge","animalSex","animalDescription"
      ],
      filters: [
        { fieldName: "animalStatus", operation: "equals", criteria: "Available" },
        { fieldName: "animalLocationDistance", operation: "radius", criteria: distance },
        { fieldName: "animalLocation", operation: "equals", criteria: postalCode }
      ]
    }
  };
}

// Detail payload
function getAnimalDetailData(animalID) {
  return {
    apikey: apiKey,
    objectType: "animals",
    objectAction: "publicSearch",
    search: {
      resultStart: 0,
      resultLimit: 1,
      fields: [
        "animalID","animalOrgID","animalName","animalSpecies","animalBreed",
        "animalPictures","animalThumbnailUrl","animalLocationCitystate","fosterEmail","animalAge",
        "animalSex","animalWeight","animalColor","animalCoatLength","animalCoatType",
        "animalStatus","animalDateAvailable","animalDescription","animalAltered"
      ],
      filters: [
        { fieldName: "animalID", operation: "equals", criteria: animalID }
      ]
    }
  };
}

// Org payload
function getAnimalOrgData(animalOrgID) {
  return {
    apikey: apiKey,
    objectType: "orgs",
    objectAction: "publicSearch",
    search: {
      resultOrder: "asc",
      fields: ["orgID","orgName","orgPhone","orgEmail","orgCity","orgState"],
      resultStart: "0",
      resultSort: "orgID",
      filters: [{ criteria: animalOrgID, fieldName: "orgID", operation: "equals" }],
      resultLimit: "1"
    }
  };
}

// POST JSON helper
async function postJson(url, jsonData) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonData),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status} - ${text}`);
    }
    return await response.json();
  } catch (err) {
    throw err;
  }
}

// Helper: extract records from RescueGroups response
function extractRecords(apiResult) {
  if (!apiResult) return [];
  if (Array.isArray(apiResult.data)) return apiResult.data;
  if (apiResult.data && typeof apiResult.data === 'object') {
    const keys = Object.keys(apiResult.data).filter(k => !isNaN(Number(k)));
    if (keys.length) return keys.map(k => apiResult.data[k]);
    if (Array.isArray(apiResult.data.animals)) return apiResult.data.animals;
  }
  return [];
}

// Helper: strip HTML tags from description
function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// Regions mapping: country -> state -> city -> postalCode
const regions = {
  US: {
    'California': {
      'Los Angeles': '90001',
      'San Francisco': '94102',
      'San Diego': '92101',
      'DEFAULT': '89019'
    },
    'Illinois': {
      'Chicago': '60601',
      'Naperville': '60540',
      'Springfield': '62701'
    },
    'New York': {
      'New York': '10001',
      'Buffalo': '14201'
    }
  },
  CA: {
    'Ontario': {
      'Toronto': 'M5H',
      'Ottawa': 'K1A',
      'DEFAULT': 'M4B'
    }
  },
  KR: {
    'Seoul': {
      'Seoul': '04524'
    }
  }
};

// UI logic
document.addEventListener('DOMContentLoaded', () => {
  const countryEl = document.getElementById('country');
  const stateEl = document.getElementById('state');
  const cityEl = document.getElementById('city');
  const distanceEl = document.getElementById('distance');
  const searchBtn = document.getElementById('searchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const loadingEl = document.getElementById('loading');
  const animalContainer = document.getElementById('animalContainer');
  const noResultsEl = document.getElementById('noResults');
  const toastEl = document.getElementById('toast');
  const toastBody = document.getElementById('toastBody');

  function showToast(message) {
    toastBody.textContent = message;
    const bsToast = new bootstrap.Toast(toastEl);
    bsToast.show();
  }

  // Populate states when country changes
  countryEl.addEventListener('change', () => {
    const country = countryEl.value;
    stateEl.innerHTML = '<option value="">Select state</option>';
    cityEl.innerHTML = '<option value="">Select city</option>';
    cityEl.disabled = true;

    if (country && regions[country]) {
      Object.keys(regions[country]).forEach(stateName => {
        const opt = document.createElement('option');
        opt.value = stateName;
        opt.textContent = stateName;
        stateEl.appendChild(opt);
      });
      stateEl.disabled = false;
    } else {
      stateEl.disabled = true;
    }
  });

  // Populate cities when state changes
  stateEl.addEventListener('change', () => {
    const country = countryEl.value;
    const stateName = stateEl.value;
    cityEl.innerHTML = '<option value="">Select city</option>';

    if (country && stateName && regions[country] && regions[country][stateName]) {
      const citiesObj = regions[country][stateName];
      Object.keys(citiesObj).forEach(cityName => {
        if (cityName === 'DEFAULT') return;
        const opt = document.createElement('option');
        opt.value = cityName;
        opt.textContent = cityName;
        cityEl.appendChild(opt);
      });
      cityEl.disabled = false;
    } else {
      cityEl.disabled = true;
    }
  });

  // Render animals
  function renderAnimals(list) {
    animalContainer.innerHTML = '';
    if (!list || list.length === 0) {
      noResultsEl.classList.remove('d-none');
      return;
    }
    noResultsEl.classList.add('d-none');

    list.forEach(a => {
      const col = document.createElement('div');
      col.className = 'col';

      const card = document.createElement('div');
      card.className = 'card h-100';

      // image
      const imgWrap = document.createElement('div');
      if (a.animalPictures && a.animalPictures[0]) {
        const url = a.animalPictures[0].urlSecureFullsize || a.animalPictures[0].urlSecureThumbnail || a.animalPictures[0].url;
        const img = document.createElement('img');
        img.src = url;
        img.alt = a.animalName || 'Animal';
        img.className = 'card-img-top';
        img.loading = 'lazy';
        imgWrap.appendChild(img);
      } else if (a.animalThumbnailUrl) {
        const img = document.createElement('img');
        img.src = a.animalThumbnailUrl;
        img.alt = a.animalName || 'Animal';
        img.className = 'card-img-top';
        img.loading = 'lazy';
        imgWrap.appendChild(img);
      } else {
        const noImg = document.createElement('div');
        noImg.className = 'no-image';
        noImg.textContent = a.animalName || 'No image';
        imgWrap.appendChild(noImg);
      }

      const body = document.createElement('div');
      body.className = 'card-body';

      const title = document.createElement('h5');
      title.className = 'card-title';
      title.textContent = a.animalName || 'Unnamed';

      const meta = document.createElement('p');
      meta.className = 'card-text text-muted small';
      meta.innerHTML = `<strong>Breed:</strong> ${a.animalBreed || '—'} • <strong>Age:</strong> ${a.animalAge || '—'}`;

      const footer = document.createElement('div');
      footer.className = 'card-footer bg-transparent border-0 pt-0';

      const detailsBtn = document.createElement('button');
      detailsBtn.className = 'btn btn-sm btn-outline-primary';
      detailsBtn.textContent = 'View details';
      detailsBtn.addEventListener('click', () => openModal(a.animalID, a.animalOrgID));

      body.appendChild(title);
      body.appendChild(meta);
      footer.appendChild(detailsBtn);

      card.appendChild(imgWrap);
      card.appendChild(body);
      card.appendChild(footer);
      col.appendChild(card);
      animalContainer.appendChild(col);
    });
  }

  // Open modal and fetch details + org info
  async function openModal(animalID, orgID) {
    document.getElementById('modalTitle').textContent = 'Loading...';
    document.getElementById('modalImage').innerHTML = '';
    document.getElementById('modalBreed').textContent = '';
    document.getElementById('modalAge').textContent = '';
    document.getElementById('modalSex').textContent = '';
    document.getElementById('modalWeight').textContent = '';
    document.getElementById('modalColor').textContent = '';
    document.getElementById('modalCoat').textContent = '';
    document.getElementById('modalAltered').textContent = '';
    document.getElementById('modalLocation').textContent = '';
    document.getElementById('modalOrg').textContent = '';
    document.getElementById('modalContact').textContent = '';
    document.getElementById('modalNotes').textContent = '';

    const modal = new bootstrap.Modal(document.getElementById('animalModal'));
    modal.show();

    try {
      const detailRes = await postJson(httpApiUrl, getAnimalDetailData(animalID));
      const detailRecords = extractRecords(detailRes);
      const animal = detailRecords[0] || {};

      document.getElementById('modalTitle').textContent = animal.animalName || 'Animal Details';

      const modalImage = document.getElementById('modalImage');
      modalImage.innerHTML = '';
      if (animal.animalPictures && animal.animalPictures[0]) {
        const url = animal.animalPictures[0].urlSecureFullsize || animal.animalPictures[0].urlSecureThumbnail || animal.animalPictures[0].url;
        const img = document.createElement('img');
        img.src = url;
        img.alt = animal.animalName || 'Animal';
        modalImage.appendChild(img);
      } else if (animal.animalThumbnailUrl) {
        const img = document.createElement('img');
        img.src = animal.animalThumbnailUrl;
        img.alt = animal.animalName || 'Animal';
        modalImage.appendChild(img);
      } else {
        modalImage.textContent = animal.animalName || 'No image';
      }

      document.getElementById('modalBreed').textContent = animal.animalBreed || '—';
      document.getElementById('modalAge').textContent = animal.animalAge || '—';
      document.getElementById('modalSex').textContent = animal.animalSex || '—';
      document.getElementById('modalWeight').textContent = animal.animalWeight || '—';
      document.getElementById('modalColor').textContent = animal.animalColor || '—';
      const coat = [animal.animalCoatLength, animal.animalCoatType].filter(Boolean).join(' / ');
      document.getElementById('modalCoat').textContent = coat || '—';
      document.getElementById('modalAltered').textContent = animal.animalAltered || 'Unknown';
      document.getElementById('modalLocation').textContent = animal.animalLocationCitystate || '—';
      document.getElementById('modalNotes').textContent = stripHtml(animal.animalDescription || '');

      // fetch org info if available
      if (orgID) {
        try {
          const orgRes = await postJson(httpApiUrl, getAnimalOrgData(orgID));
          const orgRecords = extractRecords(orgRes);
          const org = orgRecords[0] || {};
          const orgText = `${org.orgName || '—'}${org.orgCity ? ' (' + org.orgCity + (org.orgState ? ', ' + org.orgState : '') + ')' : ''}`;
          document.getElementById('modalOrg').textContent = orgText;
          const contact = org.orgEmail || org.orgPhone || animal.fosterEmail || '—';
          document.getElementById('modalContact').textContent = contact;
          const emailBtn = document.getElementById('modalEmailBtn');
          if (org.orgEmail) {
            emailBtn.href = `mailto:${org.orgEmail}?subject=Interested in adopting ${encodeURIComponent(animal.animalName || '')}`;
            emailBtn.classList.remove('disabled');
          } else if (animal.fosterEmail) {
            emailBtn.href = `mailto:${animal.fosterEmail}?subject=Interested in adopting ${encodeURIComponent(animal.animalName || '')}`;
            emailBtn.classList.remove('disabled');
          } else {
            emailBtn.href = '#';
            emailBtn.classList.add('disabled');
          }
        } catch (err) {
          console.warn('Org fetch failed', err);
        }
      } else {
        const emailBtn = document.getElementById('modalEmailBtn');
        if (animal.fosterEmail) {
          emailBtn.href = `mailto:${animal.fosterEmail}?subject=Interested in adopting ${encodeURIComponent(animal.animalName || '')}`;
          emailBtn.classList.remove('disabled');
          document.getElementById('modalContact').textContent = animal.fosterEmail;
        } else {
          emailBtn.href = '#';
          emailBtn.classList.add('disabled');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load details.');
    }
  }

  // Search handler
  searchBtn.addEventListener('click', async () => {
    const country = countryEl.value;
    const stateName = stateEl.value;
    const cityName = cityEl.value;
    const distance = distanceEl.value || '25';

    if (!country) { showToast('Please select a country.'); return; }
    if (!stateName) { showToast('Please select a state.'); return; }

    const stateObj = regions[country] && regions[country][stateName];
    if (!stateObj) { showToast('No mapping for selected state.'); return; }
    if (!cityName && !stateObj['DEFAULT']) { showToast('Please select a city or configure a default postal code for the state.'); return; }

    // Determine postal code
    let postalCode = '';
    if (cityName && stateObj[cityName]) postalCode = stateObj[cityName];
    else if (stateObj['DEFAULT']) postalCode = stateObj['DEFAULT'];

    if (!postalCode) { showToast('No postal code configured for the selected city/state.'); return; }

    loadingEl.classList.remove('d-none');
    animalContainer.innerHTML = '';
    noResultsEl.classList.add('d-none');

    try {
      const payload = getAnimalData(postalCode, distance);
      const apiRes = await postJson(httpApiUrl, payload);
      const records = extractRecords(apiRes);

      const animals = records.map(r => ({
        animalID: r.animalID || r.id,
        animalOrgID: r.animalOrgID || r.orgID,
        animalName: r.animalName || r.name,
        animalBreed: r.animalBreed,
        animalAge: r.animalAge,
        animalSex: r.animalSex,
        animalPictures: r.animalPictures || [],
        animalThumbnailUrl: r.animalThumbnailUrl,
        animalLocationCitystate: r.animalLocationCitystate,
        fosterEmail: r.fosterEmail,
        animalDescription: r.animalDescription
      }));

      renderAnimals(animals);
    } catch (err) {
      console.error(err);
      showToast('API error while searching. Try again later.');
    } finally {
      loadingEl.classList.add('d-none');
    }
  });

  // Clear handler
  clearBtn.addEventListener('click', () => {
    countryEl.value = '';
    stateEl.innerHTML = '<option value="">Select state</option>';
    stateEl.disabled = true;
    cityEl.innerHTML = '<option value="">Select city</option>';
    cityEl.disabled = true;
    animalContainer.innerHTML = '';
    noResultsEl.classList.add('d-none');
  });
});
