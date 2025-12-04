// API configuration
const httpApiUrl = "https://api.rescuegroups.org/http/v2.json";
const apiKey = "tHFlqnHF"; // Demo key; move to server for production

// Build animal search payload (list)
function getAnimalData(postalCode, distance) {
  return {
    apikey: apiKey,
    objectType: "animals",
    objectAction: "publicSearch",
    search: {
      calcFoundRows: "Yes",
      resultStart: 0,
      resultLimit: 24,
      resultSort: "animalID",
      fields: [
        "animalID","animalOrgID","animalName","animalSpecies","animalBreed",
        "animalThumbnailUrl","animalLocationCitystate","fosterEmail","animalAge","animalSex"
      ],
      filters: [
        { fieldName: "animalStatus", operation: "equals", criteria: "Available" },
        { fieldName: "animalLocationDistance", operation: "radius", criteria: distance },
        { fieldName: "animalLocation", operation: "equals", criteria: postalCode }
      ]
    }
  };
}

// Build single-animal detail payload (includes requested fields)
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
        "animalThumbnailUrl","animalLocationCitystate","fosterEmail","animalAge",
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
    const result = await response.json();
    return { status: 'ok', result };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

// Wrapper to call API and return parsed result or error object
async function postToApi(data) {
  const res = await postJson(httpApiUrl, data);
  if (res.status === 'ok') return res.result;
  return { status: 'error', text: res.error || 'API error' };
}

// UI helpers
const toastEl = document.getElementById('toast');
const toastBody = document.getElementById('toastBody');
const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
function showToast(message) {
  toastBody.textContent = message;
  bsToast.show();
}
function setLoading(on) {
  document.getElementById('loading').classList.toggle('d-none', !on);
}

// Escape HTML
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
}

// Sanitize HTML: remove tags, scripts, images, trackers and decode entities
function sanitizeHtml(html) {
  if (!html && html !== 0) return '';
  // Create a DOM element to parse the HTML
  const container = document.createElement('div');
  container.innerHTML = String(html);

  // Remove script, style, and img elements (trackers)
  const forbidden = container.querySelectorAll('script, style, img, iframe, object, embed');
  forbidden.forEach(n => n.remove());

  // Remove attributes that could be problematic (on* handlers, srcset, style)
  const all = container.querySelectorAll('*');
  all.forEach(node => {
    // remove event handlers and inline styles and tracking attributes
    [...node.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'style' || name === 'src' || name === 'srcset' || name === 'data-src') {
        node.removeAttribute(attr.name);
      }
    });
  });

  // Get plain text which decodes HTML entities
  const text = container.textContent || container.innerText || '';
  // Normalize whitespace and trim
  return text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

// Main search
async function fetchAnimals() {
  const container = document.getElementById('animalContainer');
  container.innerHTML = '';
  document.getElementById('noResults').classList.add('d-none');

  const postalCode = document.getElementById("postalCode").value.trim();
  const distance = document.getElementById("distance").value;

  if (!postalCode && !distance) { showToast('Please enter postal code and distance.'); return; }
  if (!postalCode) { showToast('Please enter a postal code.'); return; }
  if (!distance) { showToast('Please select a radius.'); return; }

  setLoading(true);

  try {
    const payload = getAnimalData(postalCode, distance);
    const result = await postToApi(payload);

    if (!result || result.status === 'error') {
      showToast(result && result.text ? result.text : 'API error');
      setLoading(false);
      return;
    }

    if (!result.data || Object.keys(result.data).length === 0 || result.foundRows === 0) {
      document.getElementById('noResults').classList.remove('d-none');
      showToast('No animals found.');
      setLoading(false);
      return;
    }

    await displayAnimals(result.data);
  } catch (err) {
    showToast(err.message || 'Error fetching animals');
  } finally {
    setLoading(false);
  }
}

// Render cards
async function displayAnimals(data) {
  const container = document.getElementById('animalContainer');
  const keys = Object.keys(data).sort((a,b)=>Number(a)-Number(b));

  for (const key of keys) {
    const animal = data[key];
    const imgUrl = animal.animalThumbnailUrl ? animal.animalThumbnailUrl.split('?')[0] : null;

    // Create card element
    const col = document.createElement('div');
    col.className = 'col';

    const card = document.createElement('div');
    card.className = 'card h-100 position-relative';

    // Image or placeholder
    if (imgUrl) {
      const img = document.createElement('img');
      img.className = 'card-img-top';
      img.src = imgUrl;
      img.alt = escapeHtml(animal.animalName || 'animal');
      card.appendChild(img);
    } else {
      const noImg = document.createElement('div');
      noImg.className = 'no-image';
      noImg.textContent = 'No image';
      card.appendChild(noImg);
    }

    // Card body
    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = `
      <h5 class="card-title mb-1">${escapeHtml(animal.animalName || 'Unnamed')}</h5>
      <p class="mb-1"><strong>Breed:</strong> ${escapeHtml(animal.animalBreed || '-')}</p>
      <p class="mb-1"><strong>Age:</strong> ${escapeHtml(animal.animalAge || '-')}</p>
      <p class="mb-1 text-muted small">${escapeHtml(animal.animalLocationCitystate || '')}</p>
    `;
    card.appendChild(body);

    // Footer with action
    const footer = document.createElement('div');
    footer.className = 'card-footer bg-transparent border-0';
    footer.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <small class="text-muted">${escapeHtml(animal.animalSpecies || '')}</small>
        <button class="btn btn-sm btn-outline-primary view-details" data-animalid="${animal.animalID}">View</button>
      </div>
    `;
    card.appendChild(footer);

    col.appendChild(card);
    container.appendChild(col);
  }

  // Attach click handlers for details
  container.querySelectorAll('.view-details').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-animalid');
      await showAnimalDetails(id);
    });
  });
}

// Show modal with extended details
async function showAnimalDetails(animalID) {
  setLoading(true);
  try {
    const detailPayload = getAnimalDetailData(animalID);
    const detailResult = await postToApi(detailPayload);

    if (!detailResult || detailResult.status === 'error' || !detailResult.data) {
      showToast('Unable to fetch animal details.');
      setLoading(false);
      return;
    }

    const key = Object.keys(detailResult.data)[0];
    const animal = detailResult.data[key];

    // Fetch org info
    let orgName = '';
    let orgPhone = '';
    let orgEmail = '';
    try {
      const orgPayload = getAnimalOrgData(animal.animalOrgID);
      const orgResult = await postToApi(orgPayload);
      if (orgResult && orgResult.data) {
        const orgKey = Object.keys(orgResult.data)[0];
        const org = orgResult.data[orgKey];
        orgName = org.orgName || '';
        orgPhone = org.orgPhone || '';
        orgEmail = org.orgEmail || '';
      }
    } catch (e) {
      // ignore
    }

    // Populate modal
    document.getElementById('modalTitle').textContent = animal.animalName || 'Animal Details';

    const modalImage = document.getElementById('modalImage');
    modalImage.innerHTML = '';
    if (animal.animalThumbnailUrl) {
      const img = document.createElement('img');
      img.src = animal.animalThumbnailUrl.split('?')[0];
      img.alt = escapeHtml(animal.animalName || 'animal');
      modalImage.appendChild(img);
    } else {
      modalImage.textContent = 'No image';
    }

    document.getElementById('modalBreed').textContent = animal.animalBreed || '-';
    document.getElementById('modalAge').textContent = animal.animalAge || '-';
    document.getElementById('modalSex').textContent = animal.animalSex || '-';
    document.getElementById('modalWeight').textContent = animal.animalWeight || '-';
    document.getElementById('modalColor').textContent = animal.animalColor || '-';
    // coat info: combine coat length/type if available
    const coatParts = [];
    if (animal.animalCoatLength) coatParts.push(animal.animalCoatLength);
    if (animal.animalCoatType) coatParts.push(animal.animalCoatType);
    document.getElementById('modalCoat').textContent = coatParts.length ? coatParts.join(' / ') : '-';
    // altered / neutered
    const altered = (animal.animalAltered === 'Yes' || animal.animalAltered === true || animal.animalAltered === 'true') ? 'Yes' :
                    (animal.animalAltered === 'No' || animal.animalAltered === false || animal.animalAltered === 'false') ? 'No' : (animal.animalAltered || '-');
    document.getElementById('modalAltered').textContent = altered;

    document.getElementById('modalLocation').textContent = animal.animalLocationCitystate || '-';
    document.getElementById('modalOrg').textContent = orgName ? `${orgName} ${orgPhone ? '• ' + orgPhone : ''}` : '-';
    document.getElementById('modalContact').textContent = animal.fosterEmail || orgEmail || '-';

    // Story / Notes: sanitize and display plain text
    const rawNotes = animal.animalDescription || '';
    const cleanNotes = sanitizeHtml(rawNotes);
    document.getElementById('modalNotes').textContent = cleanNotes || 'No additional notes.';

    // Contact button
    const email = animal.fosterEmail || orgEmail || '';
    const emailBtn = document.getElementById('modalEmailBtn');
    if (email) {
      emailBtn.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Inquiry about ' + (animal.animalName || 'animal'))}`;
      emailBtn.classList.remove('disabled');
    } else {
      emailBtn.href = '#';
      emailBtn.classList.add('disabled');
    }

    // Show modal
    const modalEl = document.getElementById('animalModal');
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

  } catch (err) {
    showToast(err.message || 'Error loading details');
  } finally {
    setLoading(false);
  }
}

// Parse simple comma/pipe/semicolon separated fields into array
function parseListField(field) {
  if (!field) return [];
  if (Array.isArray(field)) return field.map(String);
  return String(field).split(/[,|;\/]/).map(s => s.trim()).filter(Boolean);
}

// Event wiring
document.getElementById('searchBtn').addEventListener('click', fetchAnimals);
document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('postalCode').value = '';
  document.getElementById('distance').value = '';
  document.getElementById('animalContainer').innerHTML = '';
  document.getElementById('noResults').classList.add('d-none');
});
document.getElementById('postalCode').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') fetchAnimals();
});
