function createDefaultProfile(){
  return {
    player:{
      name:"CJ Player",
      level:1,
      xp:0
    },

    progression:{
      runner:{
        bestScore:0,
        bestDistance:0,
        bestCombo:0,
        runs:0
      },

      breaker:{
        bestScore:0,
        bricks:0
      }
    },

    inventory:{
      diamonds:0,
      skins:[]
    }
  }
}

function loadProfile(){
  let data = localStorage.getItem("CJ_PROFILE");
  if(!data){
    const profile = createDefaultProfile();
    localStorage.setItem("CJ_PROFILE", JSON.stringify(profile));
    // mark first run so UI can show welcome animation once
    try{ localStorage.setItem('CJ_FIRST_RUN', 'true'); }catch(e){}
    return profile;
  }
  try{
    return JSON.parse(data);
  }catch(e){
    const profile = createDefaultProfile();
    localStorage.setItem("CJ_PROFILE", JSON.stringify(profile));
    return profile;
  }
}

// initProfile: prefer engine-provided runner profile when available,
// otherwise fall back to local storage via loadProfile().
function initProfile(){
  try{
    if (typeof getRunnerProfile === 'function'){
      const r = getRunnerProfile();
      if (r) {
        // return a minimal profile shape wrapping runner progression
        return {
          player: { name: "CJ Player", level: 1, xp: 0 },
          progression: { runner: r },
          inventory: { diamonds: 0, skins: [] }
        };
      }
    }
  }catch(e){ /* ignore and fallback */ }

  // fallback to local storage profile
  return loadProfile();
}

// Backwards-friendly alias
const initProfileAlias = initProfile;

// Add XP to the current profile, handle level ups and persist.
function addXP(amount){
  if (!amount || amount <= 0) return;
  try{
    // operate on local profile as canonical fallback
    let profile = (typeof loadProfile === 'function') ? loadProfile() : createDefaultProfile();
    profile.player = profile.player || { name: 'CJ Player', level: 1, xp: 0 };
    profile.player.xp = (profile.player.xp || 0) + Math.floor(amount);
    let leveled = false;
    while(profile.player.xp >= (profile.player.level * 100)){
      profile.player.xp -= (profile.player.level * 100);
      profile.player.level += 1;
      leveled = true;
    }

    // persist local copy
    if (typeof saveProfile === 'function') saveProfile(profile);

    // sync to engine state if available
    if (typeof updateState === 'function'){
      try{
        updateState(state => {
          state.player = state.player || {};
          state.player.level = profile.player.level;
          state.player.xp = profile.player.xp;
        });
        if (typeof saveProfile === 'function') saveProfile();
      }catch(e){/* ignore */}
    }

    // notify UI about level up
    if (leveled && typeof window.onPlayerLevelUp === 'function'){
      try{ window.onPlayerLevelUp(profile.player.level); }catch(e){}
    }

    return profile;
  }catch(e){
    console.warn('addXP failed', e);
  }
}

function saveProfile(profile){
  try{
    localStorage.setItem("CJ_PROFILE", JSON.stringify(profile));
  }catch(e){
    console.warn('saveProfile failed', e);
  }
}

// Add diamonds (soft currency) to profile and persist
function addDiamonds(amount){
  if (!amount || amount <= 0) return;
  try{
    let profile = (typeof loadProfile === 'function') ? loadProfile() : createDefaultProfile();
    profile.inventory = profile.inventory || { diamonds: 0, skins: [] };
    profile.inventory.diamonds = (profile.inventory.diamonds || 0) + Math.floor(amount);
    if (typeof saveProfile === 'function') saveProfile(profile);

    // sync to engine state if available
    if (typeof updateState === 'function'){
      try{
        updateState(state => {
          state.inventory = state.inventory || {};
          state.inventory.diamonds = profile.inventory.diamonds;
        });
        if (typeof saveProfile === 'function') saveProfile();
      }catch(e){/* ignore */}
    }

    return profile.inventory.diamonds;
  }catch(e){ console.warn('addDiamonds failed', e); }
}

// Spend diamonds; returns true if spent, false if insufficient funds
function spendDiamonds(amount){
  if (!amount || amount <= 0) return false;
  try{
    let profile = (typeof loadProfile === 'function') ? loadProfile() : createDefaultProfile();
    profile.inventory = profile.inventory || { diamonds: 0, skins: [] };
    const current = profile.inventory.diamonds || 0;
    if (current < amount) return false;
    profile.inventory.diamonds = current - Math.floor(amount);
    if (typeof saveProfile === 'function') saveProfile(profile);
    if (typeof updateState === 'function'){
      try{ updateState(state => { state.inventory = state.inventory || {}; state.inventory.diamonds = profile.inventory.diamonds; }); if (typeof saveProfile === 'function') saveProfile(); }catch(e){}
    }
    return true;
  }catch(e){ console.warn('spendDiamonds failed', e); return false; }
}
