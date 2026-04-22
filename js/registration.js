/**
 * registration.js
 */

const Registration = (() => {

  const COUNTRIES = [
    'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda',
    'Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain',
    'Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan',
    'Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria',
    'Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada',
    'Central African Republic','Chad','Chile','China','Colombia','Comoros',
    'Congo (Brazzaville)','Congo (Kinshasa)','Costa Rica','Croatia','Cuba',
    'Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic',
    'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia',
    'Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia',
    'Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau',
    'Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran',
    'Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan',
    'Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho',
    'Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar',
    'Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania',
    'Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro',
    'Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands',
    'New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia',
    'Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea',
    'Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania',
    'Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia',
    'Saint Vincent and the Grenadines','Samoa','San Marino',
    'Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles',
    'Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia',
    'South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan',
    'Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania',
    'Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia',
    'Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates',
    'United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu',
    'Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
  ];

  function isContestClosed() {
    const deadline = AppState.contest.deadline;
    if (!deadline) return false;
    return Date.now() > new Date(deadline).getTime();
  }

  function populateCategorySelect() {
    const sel = document.getElementById('reg-category');
    sel.innerHTML = '<option value="">— Seleccioná una categoría —</option>';
    Object.entries(AppState.contest.categories || {}).forEach(([id, cat]) => {
      const opt       = document.createElement('option');
      opt.value       = id;
      opt.textContent = cat.name;
      sel.appendChild(opt);
    });
  }

  function populateCountrySelect() {
    const sel = document.getElementById('reg-country');
    if (!sel) return;
    sel.innerHTML = '';
    COUNTRIES.forEach(country => {
      const opt       = document.createElement('option');
      opt.value       = country;
      opt.textContent = country;
      if (country === 'El Salvador') opt.selected = true;
      sel.appendChild(opt);
    });
  }

  async function submit() {
    if (isContestClosed()) {
      UI.toast('⚠ El contest ya cerró. No se aceptan más participantes.');
      return;
    }

    const name        = document.getElementById('reg-name').value.trim();
    const email       = document.getElementById('reg-email').value.trim().toLowerCase();
    const category    = document.getElementById('reg-category').value;
    const country     = document.getElementById('reg-country').value;
    const suggestions = document.getElementById('reg-suggestions').value.trim();

    if (!name)                          { UI.toast('⚠ Ingresá tu nombre completo');         return; }
    if (!email || !email.includes('@')) { UI.toast('⚠ El correo electrónico no es válido'); return; }
    if (!category)                      { UI.toast('⚠ Seleccioná una categoría');            return; }
    if (!country)                       { UI.toast('⚠ Seleccioná tu país');                  return; }

    const alreadySubmitted = AppState.results.some(
      r => r.email === email && r.category === category
    );
    if (alreadySubmitted) {
      UI.toast('⚠ Ya enviaste resultados en esta categoría');
      return;
    }

    AppState.contestant = { name, email, category, country, suggestions };

    AppState.solves       = [];
    AppState.currentSolve = 0;
    AppState.currentPenalty = null;

    const alreadyParticipant = AppState.participants.some(
      p => p.email === email && p.category === category
    );
    if (!alreadyParticipant) {
      try {
        const participant = {
          name,
          email,
          category,
          country,
          suggestions,
          timestamp:      new Date().toISOString(),
          timerEnteredAt: new Date().toISOString(),
          pageReloads:    0,                         
        };
        await Storage.saveParticipant(participant);
        AppState.participants.push(participant);
      } catch (e) {
        console.error('[Registration] saveParticipant:', e);
        Logger.error('save_participant_failed', {
          errorMessage: e?.message || String(e),
          category,
        });
      }
    }

    Logger.info('contestant_registered', {
      category,
      country,
    });

    Timer.init(false);
    UI.showView('view-contest');
  }

  return {
    populateCategorySelect,
    populateCountrySelect,
    submit,
    isContestClosed,
    COUNTRIES,
  };
})();