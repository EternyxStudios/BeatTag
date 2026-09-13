const SUPABASE_URL = "https://axllkismvbqikwdvkayz.supabase.co";

const SUPABASE_KEY = "sb_publishable_vtacQ7gTtSepf4BSzlAQmw_aOJI3Yvw";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
/* =========================
   SUPABASE AUTH
========================= */

let authMode = "login";
let currentUserId = null;

function showAuthScreen() {
  document.getElementById("authScreen")?.classList.remove("hidden");
  document.getElementById("app")?.classList.add("hidden");
}

function showApp() {
  document.getElementById("authScreen")?.classList.add("hidden");
  document.getElementById("app")?.classList.remove("hidden");
}

function toggleAuthMode() {
  authMode = authMode === "login" ? "signup" : "login";

  const isSignup = authMode === "signup";

  document.getElementById("authTitle").textContent =
    isSignup ? "Create Account" : "Login";

  document.getElementById("authSubmitBtn").textContent =
    isSignup ? "Sign Up" : "Login";

  document.getElementById("authSwitchText").textContent =
    isSignup
      ? "Already have an account? Login"
      : "Don't have an account? Sign Up";

  document
    .querySelectorAll(".auth-only-signup")
    .forEach(el => el.classList.toggle("hidden", !isSignup));

  document.getElementById("authMessage").textContent = "";
}

async function submitAuth() {
  const name =
    document.getElementById("authName")?.value.trim() || "";

  const username =
    document.getElementById("authUsername")?.value.trim() || "";

  const email =
    document.getElementById("authEmail")?.value.trim() || "";

  const password =
    document.getElementById("authPassword")?.value || "";

  const message = document.getElementById("authMessage");
  const button = document.getElementById("authSubmitBtn");

  message.textContent = "";

  if (!email || !password) {
    message.textContent = "Email aur password required hai.";
    return;
  }

  if (password.length < 6) {
    message.textContent = "Password minimum 6 characters ka rakho.";
    return;
  }

  button.disabled = true;
  button.textContent = "Please wait...";

  try {
    if (authMode === "signup") {
      if (!name || !username) {
        message.textContent = "Name aur username bhi enter karo.";
        return;
      }

      const cleanUsername = username
        .replace(/^@/, "")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");

      if (cleanUsername.length < 3) {
        message.textContent = "Username minimum 3 characters ka rakho.";
        return;
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            "https://eternyxstudios.github.io/BeatTag/",
          data: {
            name,
            username: cleanUsername
          }
        }
      });

      if (error) throw error;

      if (!data.session) {
        message.textContent =
          "Account created ✅ Email inbox/spam me verification link check karo.";
      } else {
        showApp();
      }
    } else {
      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      if (data.session) {
        showApp();
      }
    }
  } catch (err) {
    message.textContent = err.message || "Something went wrong.";
  } finally {
    button.disabled = false;
    button.textContent =
      authMode === "signup" ? "Sign Up" : "Login";
  }
}

async function logoutBeatTag() {
  await supabaseClient.auth.signOut();
  showAuthScreen();
}

async function initAuth() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (session) {
    await loadRealProfile();
    await checkAdmin();
    await loadChallengesFromSupabase();
    await loadReactionsFromSupabase();
    await loadCommentsFromSupabase();
    await loadTagsFromSupabase();
    showApp();
  } else {
    showAuthScreen();
  }
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) {
    showApp();
  } else {
    showAuthScreen();
  }
});

window.addEventListener("DOMContentLoaded", initAuth);
const $ = s => document.querySelector(s);
const screenEl = $('#screen');
const modal = $('#modal');
const modalCard = $('#modalCard');

const DBKEY = 'beattag_v2_state';

let state =
  JSON.parse(localStorage.getItem(DBKEY) || 'null') ||
  seedState();
async function loadRealProfile() {
  try {
    const {
      data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) return;
    currentUserId = user.id;

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Profile load error:", error);
      return;
    }

    const localProfile = state.profiles[state.currentProfile];

    if (localProfile && profile) {
      localProfile.name =
        profile.name || user.user_metadata?.name || "BeatTag User";

      localProfile.handle =
        "@" + (
          profile.username ||
          user.user_metadata?.username ||
          "user"
        );

      localProfile.coins = profile.coins ?? 100;
      localProfile.streak = profile.streak ?? 0;
      localProfile.bio = profile.bio || "";

      save();

      const coinEl = document.getElementById("coinCount");
      if (coinEl) coinEl.textContent = localProfile.coins;
    }
  } catch (err) {
    console.error("Profile error:", err);
  }
}
let isAdmin = false;

async function checkAdmin() {
  try {
    if (!currentUserId) {
      isAdmin = false;
      return;
    }

    const { data, error } =
      await supabaseClient
        .from('admins')
        .select('user_id')
        .eq('user_id', currentUserId)
        .maybeSingle();

    if (error) {
      console.error('Admin check error:', error);
      isAdmin = false;
      return;
    }

    isAdmin = !!data;

  } catch (err) {
    console.error('Admin check error:', err);
    isAdmin = false;
  }
}
async function loadReactionsFromSupabase() {
  try {
    const { data: reactions, error } =
      await supabaseClient
        .from('reactions')
        .select('*');

    if (error) throw error;

    state.challenges.forEach(c => {
      c.likes = {};
      c.dislikes = {};
    });

    (reactions || []).forEach(r => {
      const challenge =
        state.challenges.find(
          c => c.id === r.challenge_id
        );

      if (!challenge) return;

      if (r.reaction_type === 'like') {
        challenge.likes[r.user_id] = true;
      }

      if (r.reaction_type === 'dislike') {
        challenge.dislikes[r.user_id] = true;
      }
    });

    save();

    console.log(
      'Supabase reactions loaded:',
      reactions?.length || 0
    );

  } catch (err) {
    console.error(
      'loadReactionsFromSupabase error:',
      err
    );
  }
}
async function loadCommentsFromSupabase() {
  try {
    const { data: comments, error } =
      await supabaseClient
        .from('comments')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) throw error;

    const userIds = [
      ...new Set(
        (comments || [])
          .map(c => c.user_id)
          .filter(Boolean)
      )
    ];

    let profileMap = {};

    if (userIds.length) {
      const { data: profiles } =
        await supabaseClient
          .from('profiles')
          .select('id,name,username')
          .in('id', userIds);

      (profiles || []).forEach(p => {
        profileMap[p.id] = p;
      });
    }

    state.challenges.forEach(c => {
      c.comments = [];
    });

    (comments || []).forEach(item => {
      const challenge =
        state.challenges.find(
          c => c.id === item.challenge_id
        );

      if (!challenge) return;

      const p = profileMap[item.user_id];

      challenge.comments.push({
        profile: item.user_id,
        name:
          p?.name ||
          p?.username ||
          'BeatTag User',
        text: item.comment_text,
        time:
          new Date(item.created_at).getTime()
      });
    });

    save();

    console.log(
      'Supabase comments loaded:',
      comments?.length || 0
    );

  } catch (err) {
    console.error(
      'loadCommentsFromSupabase error:',
      err
    );
  }
}
async function loadTagsFromSupabase() {
  try {
    const { data: tags, error } =
      await supabaseClient
        .from('challenge_tags')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) throw error;

    state.challenges.forEach(c => {
      c.tags = [];
    });

    (tags || []).forEach(tag => {
      const challenge =
        state.challenges.find(
          c => c.id === tag.challenge_id
        );

      if (!challenge) return;

      const name =
        tag.tagged_name ||
        tag.friend_name;

      if (
        name &&
        !challenge.tags.includes(name)
      ) {
        challenge.tags.push(name);
      }
    });

    save();

    console.log(
      'Supabase tags loaded:',
      tags?.length || 0
    );

  } catch (err) {
    console.error(
      'loadTagsFromSupabase error:',
      err
    );
  }
}
async function loadChallengesFromSupabase() {
  try {
    const { data: challenges, error } = await supabaseClient
      .from("challenges")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Challenge load error:", error);
      return;
    }

    if (!challenges || !challenges.length) return;

    const creatorIds = [
      ...new Set(
        challenges
          .map(c => c.creator_id)
          .filter(Boolean)
      )
    ];

    let profileMap = {};

    if (creatorIds.length) {
      const { data: profiles, error: profileError } =
        await supabaseClient
          .from("profiles")
          .select("id,name,username")
          .in("id", creatorIds);

      if (!profileError && profiles) {
        profiles.forEach(p => {
          profileMap[p.id] = p;
        });
      }
    }

    const cloudChallenges = challenges.map(c => {
      const creatorProfile = profileMap[c.creator_id];

      return {
        id: c.id,
        creator: c.creator_id,
        creatorName:
          creatorProfile?.name ||
          creatorProfile?.username ||
          "BeatTag User",

        title: c.title,
        type: c.challenge_type,
        text: c.description || "",

        createdAt:
          new Date(c.created_at).getTime(),

        parentId: c.parent_id,
        generation: c.generation || 1,

        likes: {},
        dislikes: {},
        comments: [],

        attempts: c.attempts_count || 0,
        tags: [],

        media: c.media_url
          ? {
              kind:
                c.challenge_type === "photo"
                  ? "image"
                  : c.challenge_type,
              data: c.media_url
            }
          : null
      };
    });

    state.challenges = cloudChallenges;

    save();

    console.log(
      "Supabase challenges loaded:",
      cloudChallenges.length
    );

  } catch (err) {
    console.error(
      "loadChallengesFromSupabase error:",
      err
    );
  }
}
let currentType = 'text';
let captureBlob = null;
let captureUrl = '';
let recorder = null;
let chunks = [];
let stream = null;


/* =========================
   START DATA
========================= */

function seedState() {
  return {
    currentProfile: 'p1',

    profiles: {
      p1: {
        id: 'p1',
        name: 'Mithilesh',
        handle: '@mithilesh',
        coins: 280,
        streak: 3,
        unlocks: [],
        createdAt: Date.now()
      }
    },

    challenges: [
      {
        id: 'c1',
        creator: 'p1',
        creatorName: 'Mithilesh',
        title: 'Can you take a better sunset photo?',
        type: 'text',
        text: 'Post a better sunset photo than mine 🌇',
        createdAt: Date.now() - 7200000,
        parentId: null,
        generation: 1,
        likes: {
          demo1: true,
          demo2: true,
          demo3: true
        },
        dislikes: {},
        comments: [
          {
            profile: 'demo1',
            name: 'Rahul',
            text: 'Challenge accepted 🔥',
            time: Date.now() - 100000
          }
        ],
        attempts: 4,
        tags: ['Shivam'],
        media: null
      },

      {
        id: 'c2',
        creator: 'guest1',
        creatorName: 'Aman',
        title: 'Beat my 30 push-ups!',
        type: 'text',
        text: '30 push-ups in one go. Can you beat it? 💪',
        createdAt: Date.now() - 14400000,
        parentId: null,
        generation: 1,
        likes: {
          demo1: true,
          demo2: true
        },
        dislikes: {},
        comments: [],
        attempts: 2,
        tags: [],
        media: null
      }
    ],

    notifications: [
      {
        text: 'Welcome to BeatTag 🔥',
        time: Date.now(),
        read: false
      }
    ],

    purchases: []
  };
}


/* =========================
   BASIC HELPERS
========================= */

function save() {
  try {
    localStorage.setItem(
      DBKEY,
      JSON.stringify(state)
    );
  } catch (e) {
    console.warn('Storage full:', e);

    toast(
      'Storage full. Large photo/video browser me save nahi ho paaya.'
    );
  }

  updateCoins();
  updateNotificationDot();
}

function profile() {
  return state.profiles[state.currentProfile];
}

function updateCoins() {
  const e = $('#coinCount');

  if (e) {
    e.textContent = profile().coins;
  }
}

function updateNotificationDot() {
  const dot = $('#notifDot');

  if (!dot) return;

  const unread =
    state.notifications.some(
      n => !n.read
    );

  dot.classList.toggle(
    'hidden',
    !unread
  );
}

function fmt(t) {
  const m =
    Math.floor(
      (Date.now() - t) / 60000
    );

  if (m < 1) return 'now';
  if (m < 60) return m + 'm ago';

  const h =
    Math.floor(m / 60);

  if (h < 24) return h + 'h ago';

  return (
    Math.floor(h / 24) +
    'd ago'
  );
}

function toast(msg) {
  const old =
    document.querySelector('.toast');

  if (old) old.remove();

  const d =
    document.createElement('div');

  d.className = 'toast';
  d.textContent = msg;

  document.body.appendChild(d);

  setTimeout(() => {
    d.remove();
  }, 1800);
}


/* =========================
   NAVIGATION
========================= */

function go(tab) {

  stopStream();

  document
    .querySelectorAll(
      '.bottom-nav button'
    )
    .forEach(b => {

      b.classList.toggle(
        'active',
        b.dataset.tab === tab
      );

    });

  if (tab === 'home') {
    renderHome();
  }

  if (tab === 'explore') {
    renderExplore();
  }

  if (tab === 'featured') {
    renderFeatured();
  }

  if (tab === 'create') {
    renderCreate();
  }

  if (tab === 'chains') {
    renderChains();
  }

  if (tab === 'shop') {
    renderShop();
  }

  if (tab === 'profile') {
    renderProfile();
  }

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


/* =========================
   FEATURED SCORE
========================= */

function featuredScore(c) {

  const likes =
    Object.keys(
      c.likes || {}
    ).length;

  const comments =
    (c.comments || []).length;

  const attempts =
    c.attempts || 0;

  return (
    likes * 3 +
    comments * 2 +
    attempts * 4 +
    c.generation
  );
}

function getFeaturedChallenges(
  limit = 5
) {

  return state.challenges
    .slice()
    .sort(
      (a, b) =>
        featuredScore(b) -
        featuredScore(a)
    )
    .slice(0, limit);
}


/* =========================
   HOME
========================= */

function renderHome() {

  screenEl.innerHTML = `

    <section class="hero">

      <h1>
        Beat it. Tag them.<br>
        Keep it going.
      </h1>

      <p>
        Create any challenge,
        beat your friends
        and grow the chain.
      </p>

      <div class="hero-actions">

        <button
          class="primary"
          onclick="go('create')">
          ＋ Create Challenge
        </button>

        <button
          class="secondary"
          onclick="go('featured')">
          ⭐ Featured
        </button>

      </div>

    </section>


    <section class="featured-section">

      <div class="featured-header">

        <h2>
          ⭐ Featured Challenges
        </h2>

        <button
          class="ghost"
          onclick="go('featured')">
          View All
        </button>

      </div>

      <div
        class="featured-list"
        id="homeFeatured">
      </div>

    </section>


    <div class="pills">

      <button
        class="pill active"
        onclick="renderFeed('all',this)">
        For You
      </button>

      <button
        class="pill"
        onclick="renderFeed('trending',this)">
        🔥 Trending
      </button>

      <button
        class="pill"
        onclick="renderFeed('friends',this)">
        Friends
      </button>

      <button
        class="pill"
        onclick="renderFeed('new',this)">
        New
      </button>

    </div>


    <div class="section-title">

      <h2>
        Challenges
      </h2>

      <span class="muted">
        ${state.challenges.length} posts
      </span>

    </div>

    <div id="feed"></div>
  `;

  renderFeaturedStrip();

  renderFeed('all');
}


/* =========================
   HOME FEATURED STRIP
========================= */

function renderFeaturedStrip() {

  const box =
    $('#homeFeatured');

  if (!box) return;

  const featured =
    getFeaturedChallenges(4);

  box.innerHTML = '';

  if (!featured.length) {

    box.innerHTML = `
      <div class="empty">
        Featured challenge abhi nahi hai.
      </div>
    `;

    return;
  }

  featured.forEach(
    (c, index) => {

      const likes =
        Object.keys(
          c.likes || {}
        ).length;

      const comments =
        (c.comments || []).length;

      const el =
        document.createElement('div');

      el.className =
        'featured-card';

      el.innerHTML = `

        <div class="featured-rank">
          #${index + 1}
        </div>

        <div class="featured-badge">
          ⭐ FEATURED
        </div>

        <h3>
          ${escapeHTML(c.title)}
        </h3>

        <p>
          by ${escapeHTML(c.creatorName)}
        </p>

        <div class="featured-stats">

          <span>
            ❤️ ${likes}
          </span>

          <span>
            💬 ${comments}
          </span>

          <span>
            🔥 ${c.attempts || 0}
          </span>

          <span>
            ⛓ Gen ${c.generation}
          </span>

        </div>

        <button
          class="primary"
          style="width:100%;margin-top:14px"
          onclick="openBeat('${c.id}')">

          🔥 Beat This

        </button>
      `;

      box.appendChild(el);
    }
  );
}


/* =========================
   HOME FILTERS
========================= */

function renderFeed(
  mode = 'all',
  button = null
) {

  const feed = $('#feed');

  if (!feed) return;

  if (button) {

    document
      .querySelectorAll('.pills .pill')
      .forEach(b =>
        b.classList.remove('active')
      );

    button.classList.add(
      'active'
    );
  }

  let arr =
    state.challenges.slice();

  if (mode === 'trending') {

    arr.sort(
      (a, b) =>
        featuredScore(b) -
        featuredScore(a)
    );

  } else if (mode === 'new') {

    arr.sort(
      (a, b) =>
        b.createdAt -
        a.createdAt
    );

  } else if (mode === 'friends') {

    arr =
      arr.filter(
        c =>
          c.creator !==
          state.currentProfile
      );

  } else {

    arr.sort(
      (a, b) =>
        b.createdAt -
        a.createdAt
    );
  }

  feed.innerHTML = '';

  if (!arr.length) {

    feed.innerHTML = `
      <div class="empty">
        No challenges found.
      </div>
    `;

    return;
  }

  arr.forEach(c => {

    feed.appendChild(
      challengeCard(c)
    );

  });
}


/* =========================
   MEDIA
========================= */

function mediaHTML(c) {

  if (
    c.media?.kind === 'image'
  ) {

    return `
      <img
        src="${c.media.data}"
        alt="challenge">
    `;
  }

  if (
    c.media?.kind === 'video'
  ) {

    return `
      <video
        src="${c.media.data}"
        controls
        playsinline>
      </video>
    `;
  }

  if (
    c.media?.kind === 'audio'
  ) {

    return `
      <audio
        src="${c.media.data}"
        controls>
      </audio>
    `;
  }

  return `
    <div class="text-media">
      ${escapeHTML(
        c.text || c.title
      )}
    </div>
  `;
}


/* =========================
   CHALLENGE CARD
========================= */

function challengeCard(c) {

  const n =
    $('#challengeCardTpl')
      .content
      .cloneNode(true);

  const article =
    n.querySelector(
      '.challenge-card'
    );

  const topFeatured =
    getFeaturedChallenges(3)
      .some(
        x => x.id === c.id
      );

  if (topFeatured) {
    article.classList.add(
      'featured'
    );
  }

  n.querySelector(
    '.creatorName'
  ).textContent =
    c.creatorName;

  n.querySelector(
    '.avatar'
  ).textContent =
    (c.creatorName || '?')
      [0]
      .toUpperCase();

  n.querySelector(
    '.meta'
  ).textContent =
    `${fmt(c.createdAt)} • Generation ${c.generation}`;

  n.querySelector(
    '.challenge-title'
  ).textContent =
    c.title;

  n.querySelector(
    '.media-wrap'
  ).innerHTML =
    mediaHTML(c);

  const like =
    n.querySelector('.likeBtn');

  const dis =
    n.querySelector(
      '.dislikeBtn'
    );

  const pid =
    state.currentProfile;

  like.querySelector(
    'span'
  ).textContent =
    Object.keys(
      c.likes || {}
    ).length;

  dis.querySelector(
    'span'
  ).textContent =
    Object.keys(
      c.dislikes || {}
    ).length;

  n.querySelector(
    '.commentBtn span'
  ).textContent =
    (c.comments || []).length;

  like.classList.toggle(
    'active',
    !!c.likes?.[pid]
  );

  dis.classList.toggle(
    'active',
    !!c.dislikes?.[pid]
  );

  like.onclick =
    () =>
      react(
        c.id,
        'like'
      );

  dis.onclick =
    () =>
      react(
        c.id,
        'dislike'
      );

  n.querySelector(
    '.commentBtn'
  ).onclick =
    () =>
      openComments(c.id);

  n.querySelector(
    '.beatBtn'
  ).onclick =
    () =>
      openBeat(c.id);

  n.querySelector(
    '.tagBtn'
  ).onclick =
    () =>
      tagFriend(c.id);

  n.querySelector(
    '.shareBtn'
  ).onclick =
    () =>
      shareChallenge(c.id);
  n.querySelector(
  '.dots'
).onclick =
  () =>
    openChallengeMenu(c.id);

  const taggedNames =
  (c.tags || []).length
    ? ` • 👥 Tagged: ${c.tags.join(', ')}`
    : '';

const parentChallenge =
  c.parentId
    ? state.challenges.find(
        x => x.id === c.parentId
      )
    : null;

const parentText =
  parentChallenge
    ? ` • ↳ Beat: ${parentChallenge.title}`
    : '';

n.querySelector(
  '.chainline'
).textContent =
  `🔗 ${c.attempts || 0} attempts • Generation ${c.generation}${parentText}${taggedNames}`;
  return n;
}
function openChallengeMenu(id) {

  const c =
    state.challenges.find(
      x => x.id === id
    );

  if (!c) return;

  const isMine =
    c.creator === currentUserId;

  modal.classList.remove('hidden');

  modalCard.innerHTML = `
    <div class="modal-head">
      <h3>Challenge Options</h3>

      <button
        class="close"
        onclick="closeModal()">
        ×
      </button>
    </div>

    <div style="
      display:flex;
      flex-direction:column;
      gap:10px;
      margin-top:15px;
    ">

      ${
        isMine
          ? `
            <button
              class="secondary"
              onclick="editChallenge('${c.id}')">
              ✏️ Edit Challenge
            </button>
          `
          : ''
      }

      <button
        class="secondary"
        onclick="
          closeModal();
          shareChallenge('${c.id}');
        ">
        📤 Share Challenge
      </button>

      ${
        isMine
          ? `
            <button
              class="secondary"
              onclick="
                closeModal();
                deleteChallenge('${c.id}');
              ">
              🗑 Delete Challenge
            </button>
          `
          : `
            <button
              class="secondary"
              onclick="reportChallenge('${c.id}')">
              🚩 Report Challenge
            </button>
          `
      }

    </div>
  `;
}
async function editChallenge(id) {

  const c =
    state.challenges.find(
      x => x.id === id
    );

  if (!c) return;

  if (c.creator !== currentUserId) {
    toast('Sirf apna challenge edit kar sakte ho.');
    return;
  }

  const newTitle =
    prompt(
      'Challenge title:',
      c.title
    );

  if (newTitle === null) return;

  const cleanTitle =
    newTitle.trim();

  if (!cleanTitle) {
    toast('Title empty nahi ho sakta.');
    return;
  }

  const newText =
    prompt(
      'Challenge message / rules:',
      c.text || ''
    );

  if (newText === null) return;

  try {

    const { error } =
      await supabaseClient
        .from('challenges')
        .update({
          title: cleanTitle,
          description: newText.trim()
        })
        .eq('id', id)
        .eq('creator_id', currentUserId);

    if (error) throw error;

    c.title = cleanTitle;
    c.text = newText.trim();

    save();

    closeModal();
    renderHome();

    toast('Challenge updated ✅');

  } catch (err) {

    console.error(
      'Edit challenge error:',
      err
    );

    toast(
      err.message ||
      'Challenge edit nahi hua.'
    );
  }
}


function reportChallenge(id) {

  const c = state.challenges.find(
    x => x.id === id
  );

  if (!c) return;

  if (c.creator === currentUserId) {
    closeModal();
    toast('Apna challenge report nahi kar sakte.');
    return;
  }

  modal.classList.remove('hidden');

  modalCard.innerHTML = `
    <div class="modal-head">
      <h3>🚩 Report Challenge</h3>

      <button
        class="close"
        onclick="closeModal()">
        ×
      </button>
    </div>

    <p style="margin-top:10px;">
      Is challenge ko report kyun kar rahe ho?
    </p>

    <select
      id="reportReason"
      style="width:100%; margin-top:12px;">
      <option value="">Select reason</option>
      <option value="spam">Spam</option>
      <option value="harassment">Harassment</option>
      <option value="dangerous">Dangerous Challenge</option>
      <option value="inappropriate">Inappropriate Content</option>
      <option value="other">Other</option>
    </select>

    <textarea
      id="reportDetails"
      placeholder="Additional details (optional)"
      style="width:100%; margin-top:12px;">
    </textarea>

    <button
      class="primary"
      style="width:100%; margin-top:15px;"
      onclick="submitChallengeReport('${id}')">
      Submit Report
    </button>
  `;
}


async function submitChallengeReport(id) {

  const reason =
    document
      .getElementById('reportReason')
      ?.value;

  const details =
    document
      .getElementById('reportDetails')
      ?.value
      .trim();

  if (!reason) {
    toast('Report reason select karo.');
    return;
  }

  if (!currentUserId) {
    toast('Please login first.');
    return;
  }

  try {

    const { error } =
      await supabaseClient
        .from('reports')
        .insert({
          challenge_id: id,
          reported_by: currentUserId,
          reason: reason,
          details: details || null
        });

    if (error) {

      if (error.code === '23505') {
        closeModal();
        toast('Aap is challenge ko already report kar chuke ho.');
        return;
      }

      throw error;
    }

    closeModal();

    toast('Report submitted successfully 🚩');

  } catch (err) {

    console.error(
      'Report challenge error:',
      err
    );

    toast(
      err.message ||
      'Report submit nahi hua.'
    );
  }
}

async function deleteChallenge(id) {

  const challenge =
    state.challenges.find(
      c => c.id === id
    );

  if (!challenge) return;

  if (challenge.creator !== currentUserId) {
    toast('Sirf apna challenge delete kar sakte ho.');
    return;
  }

  const ok = confirm(
    `Delete "${challenge.title}"?\n\nYe action undo nahi hoga.`
  );

  if (!ok) return;

  try {

    /* GET EXACT MEDIA URL FROM DATABASE */
    const {
      data: dbChallenge,
      error: fetchError
    } =
      await supabaseClient
        .from('challenges')
        .select('media_url')
        .eq('id', id)
        .eq('creator_id', currentUserId)
        .single();

    if (fetchError) throw fetchError;


    /* DELETE MEDIA FROM STORAGE */
    if (dbChallenge?.media_url) {

      const mediaUrl =
        dbChallenge.media_url;

      const marker =
        '/storage/v1/object/public/challenge-media/';

      const url =
        new URL(mediaUrl);

      const pathname =
        decodeURIComponent(url.pathname);

      const markerIndex =
        pathname.indexOf(marker);

      if (markerIndex === -1) {
        throw new Error(
          'Storage media path nahi mila.'
        );
      }

      const filePath =
        pathname.substring(
          markerIndex + marker.length
        );

      console.log(
        'Deleting Storage file:',
        filePath
      );

      const {
        data: removedFiles,
        error: storageError
      } =
        await supabaseClient.storage
          .from('challenge-media')
          .remove([filePath]);

      if (storageError) {
        throw storageError;
      }

      console.log(
        'Storage deleted:',
        removedFiles
      );
    }


    /* DELETE DATABASE CHALLENGE */
    const { error: deleteError } =
      await supabaseClient
        .from('challenges')
        .delete()
        .eq('id', id)
        .eq('creator_id', currentUserId);

    if (deleteError) {
      throw deleteError;
    }


    /* REMOVE FROM LOCAL STATE */
    state.challenges =
      state.challenges.filter(
        c => c.id !== id
      );

    save();

    renderHome();

    toast(
      dbChallenge?.media_url
        ? 'Challenge + media deleted 🗑'
        : 'Challenge deleted 🗑'
    );

  } catch (err) {

    console.error(
      'Delete challenge error:',
      err
    );

    toast(
      err.message ||
      'Challenge delete nahi hua.'
    );
  }
}

/* =========================
   LIKE / DISLIKE
========================= */
async function react(id, type) {

  const c =
    state.challenges.find(
      x => x.id === id
    );

  if (!c) return;

  const scrollY =
    window.scrollY;

  try {

    const {
      data: { user },
      error: userError
    } =
      await supabaseClient.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      toast('Pehle login karo.');
      return;
    }

    const {
      data: existing,
      error: checkError
    } =
      await supabaseClient
        .from('reactions')
        .select('*')
        .eq('challenge_id', id)
        .eq('user_id', user.id)
        .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (
      existing &&
      existing.reaction_type === type
    ) {

      const { error: deleteError } =
        await supabaseClient
          .from('reactions')
          .delete()
          .eq('challenge_id', id)
          .eq('user_id', user.id);

      if (deleteError) {
        throw deleteError;
      }

    } else {

      const { error: upsertError } =
        await supabaseClient
          .from('reactions')
          .upsert(
            {
              challenge_id: id,
              user_id: user.id,
              reaction_type: type
            },
            {
              onConflict:
                'challenge_id,user_id'
            }
          );

      if (upsertError) {
        throw upsertError;
      }
    }

    await loadReactionsFromSupabase();

    renderHome();

    requestAnimationFrame(() => {
      window.scrollTo(
        0,
        scrollY
      );
    });

  } catch (err) {

    console.error(
      'Reaction error:',
      err
    );

    toast(
      err.message ||
      'Reaction save nahi hua.'
    );
  }
}

/* =========================
   FEATURED PAGE
========================= */

function renderFeatured() {

  const arr =
    getFeaturedChallenges(
      state.challenges.length
    );

  screenEl.innerHTML = `

    <div class="section-title">

      <h2>
        ⭐ Featured
      </h2>

      <span class="muted">
        Top challenges
      </span>

    </div>

    <section class="panel">

      <strong>
        How Featured works
      </strong>

      <p class="muted">
        Likes, comments, attempts
        aur challenge generations
        ke basis par top challenges
        yahan rank hote hain.
      </p>

    </section>

    <div id="featuredFeed"></div>
  `;

  const feed =
    $('#featuredFeed');

  if (!arr.length) {

    feed.innerHTML = `
      <div class="empty">
        No featured challenges yet.
      </div>
    `;

    return;
  }

  arr.forEach(
    (c, index) => {

      const rank =
        document.createElement(
          'div'
        );

      rank.innerHTML = `
        <div
          class="featured-badge"
          style="margin-bottom:8px">
          ⭐ #${index + 1} Featured
          • Score ${featuredScore(c)}
        </div>
      `;

      feed.appendChild(rank);

      feed.appendChild(
        challengeCard(c)
      );
    }
  );
}


/* =========================
   EXPLORE
========================= */

function renderExplore() {

  screenEl.innerHTML = `

    <div class="section-title">

      <h2>
        Explore
      </h2>

    </div>

    <div class="searchbar">

      <input
        id="search"
        placeholder="Search challenges, users...">

      <button
        class="primary"
        onclick="doSearch()">
        Search
      </button>

    </div>

    <div class="pills">

      <button
        class="pill active"
        data-filter="all">
        All
      </button>

      <button
        class="pill"
        data-filter="photo">
        📷 Photo
      </button>

      <button
        class="pill"
        data-filter="video">
        🎥 Video
      </button>

      <button
        class="pill"
        data-filter="audio">
        🎙 Audio
      </button>

      <button
        class="pill"
        data-filter="text">
        ✍ Text
      </button>

    </div>

    <div id="results"></div>
  `;

  $('#search')
    .addEventListener(
      'input',
      doSearch
    );

  document
    .querySelectorAll(
      '[data-filter]'
    )
    .forEach(b => {

      b.onclick = () => {

        document
          .querySelectorAll(
            '[data-filter]'
          )
          .forEach(x =>
            x.classList.remove(
              'active'
            )
          );

        b.classList.add(
          'active'
        );

        doSearch(
          b.dataset.filter
        );
      };

    });

  doSearch('all');
}

function doSearch(
  typeFilter = null
) {

  const q =
    ($('#search')?.value || '')
      .trim()
      .toLowerCase();

  const active =
    document.querySelector(
      '[data-filter].active'
    );

  const filter =
    typeFilter ||
    active?.dataset.filter ||
    'all';

  const out =
    $('#results');

  if (!out) return;

  let arr =
    state.challenges.filter(
      c => {

        const textMatch =
          !q ||
          `${c.title} ${c.text || ''} ${c.creatorName}`
            .toLowerCase()
            .includes(q);

        const typeMatch =
          filter === 'all' ||
          c.type === filter;

        return (
          textMatch &&
          typeMatch
        );
      }
    );

  out.innerHTML = '';

  if (!arr.length) {

    out.innerHTML = `
      <div class="empty">
        No challenge found.
      </div>
    `;

    return;
  }

  arr.forEach(
    c =>
      out.appendChild(
        challengeCard(c)
      )
  );
}


/* =========================
   CREATE
========================= */

function renderCreate(
  parentId = null
) {

  currentType = 'text';

  captureBlob = null;
  captureUrl = '';

  screenEl.innerHTML = `

    <div class="section-title">

      <h2>
        ${
          parentId
            ? 'Beat this challenge'
            : 'Create Challenge'
        }
      </h2>

    </div>

    <section class="panel">

      <div class="type-tabs">

        <button
          class="active"
          data-type="text">
          Text
        </button>

        <button
          data-type="photo">
          Photo
        </button>

        <button
          data-type="video">
          Video
        </button>

        <button
          data-type="audio">
          Audio
        </button>

      </div>

      <div class="field">

        <label>
          Challenge title
        </label>

        <input
          id="titleInput"
          maxlength="100"
          placeholder="Can you beat this?">

      </div>

      <div class="field">

        <label>
          Message / rules
        </label>

        <textarea
          id="textInput"
          placeholder="Explain the challenge..."></textarea>

      </div>

      <div id="captureArea"></div>

      <div class="field">

        <label>
          Tag friends
        </label>

        <input
          id="tagInput"
          placeholder="Rahul, Aman, Priya">

      </div>

      <button
        class="primary"
        style="width:100%"
        id="postBtn">

        ${
          parentId
            ? '🔥 Post Attempt'
            : '🚀 Publish Challenge'
        }

      </button>

    </section>
  `;

  document
    .querySelectorAll(
      '.type-tabs button'
    )
    .forEach(b => {

      b.onclick = () => {

        document
          .querySelectorAll(
            '.type-tabs button'
          )
          .forEach(
            x =>
              x.classList.remove(
                'active'
              )
          );

        b.classList.add(
          'active'
        );

        currentType =
          b.dataset.type;

        renderCapture();
      };

    });

  $('#postBtn').onclick =
    () =>
      publishChallenge(
        parentId
      );

  renderCapture();
}


/* =========================
   CAMERA / CHOOSE FILE
========================= */

function renderCapture() {

  const a =
    $('#captureArea');

  if (!a) return;

  if (
    currentType === 'text'
  ) {

    a.innerHTML = '';

    stopStream();

    return;
  }

  const accept =
    currentType === 'photo'
      ? 'image/*'
      : currentType === 'video'
      ? 'video/*'
      : 'audio/*';

  a.innerHTML = `

    <div class="capture-box">

      <strong>
        ${
          currentType === 'photo'
            ? '📷 Photo'
            : currentType === 'video'
            ? '🎥 Video'
            : '🎙 Audio'
        }
      </strong>

      <div class="capture-actions">

        ${
          currentType !== 'audio'
            ? `
              <button
                type="button"
                class="secondary"
                onclick="openCamera('${currentType}')">
                Open Camera
              </button>
            `
            : `
              <button
                type="button"
                class="secondary"
                id="audioRecordBtn"
                onclick="toggleAudioRecord()">
                Start Recording
              </button>
            `
        }

        <button
          type="button"
          class="secondary"
          id="chooseFileBtn">
          Choose File
        </button>

        <input
          id="filePick"
          type="file"
          accept="${accept}"
          hidden>

      </div>

      <div
        class="capture-preview"
        id="preview">
      </div>

    </div>
  `;

  const chooseFileBtn =
    $('#chooseFileBtn');

  const filePick =
    $('#filePick');

  if (
    chooseFileBtn &&
    filePick
  ) {

    chooseFileBtn.onclick =
      () => {
        filePick.click();
      };

    filePick.onchange =
      e => {

        const file =
          e.target.files &&
          e.target.files[0];

        if (file) {

          fileChosen(file);

        }
      };
  }
}


/* =========================
   CAMERA
========================= */

async function openCamera(kind) {

  stopStream();

  try {

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      toast(
        'Camera browser me available nahi hai.'
      );

      return;
    }

    stream =
      await navigator
        .mediaDevices
        .getUserMedia({
          video: {
            facingMode:
              'environment'
          },
          audio:
            kind === 'video'
        });

    const p =
      $('#preview');

    p.innerHTML = `

      <video
        id="liveCam"
        autoplay
        playsinline
        muted>
      </video>

      <div class="capture-actions">

        <button
          class="primary"
          id="snapBtn">

          ${
            kind === 'photo'
              ? '📸 Take Photo'
              : '🔴 Start Video'
          }

        </button>

      </div>
    `;

    $('#liveCam').srcObject =
      stream;

    if (
      kind === 'photo'
    ) {

      $('#snapBtn').onclick =
        takePhoto;

    } else {

      $('#snapBtn').onclick =
        startVideoRecord;
    }

  } catch (e) {

    console.error(e);

    toast(
      'Camera permission allow karo ya Choose File use karo.'
    );
  }
}

function takePhoto() {

  const v =
    $('#liveCam');

  if (!v) return;

  const c =
    document.createElement(
      'canvas'
    );

  c.width =
    v.videoWidth || 720;

  c.height =
    v.videoHeight || 1280;

  c.getContext('2d')
    .drawImage(
      v,
      0,
      0,
      c.width,
      c.height
    );

  c.toBlob(
    async b => {

      captureBlob = b;

      captureUrl =
        await blobToDataURL(b);

      stopStream();

      showCaptured(
        'image'
      );

    },
    'image/jpeg',
    0.82
  );
}


/* =========================
   VIDEO
========================= */

function startVideoRecord() {

  if (!stream) {

    toast(
      'Camera start nahi hua.'
    );

    return;
  }

  if (
    typeof MediaRecorder ===
    'undefined'
  ) {

    toast(
      'Video recording browser support nahi karta. Choose File use karo.'
    );

    return;
  }

  chunks = [];

  recorder =
    new MediaRecorder(stream);

  recorder.ondataavailable =
    e => {

      if (e.data.size) {

        chunks.push(e.data);

      }
    };

  recorder.onstop =
    async () => {

      captureBlob =
        new Blob(
          chunks,
          {
            type:
              recorder.mimeType ||
              'video/webm'
          }
        );

      captureUrl =
        await blobToDataURL(
          captureBlob
        );

      stopStream();

      showCaptured(
        'video'
      );
    };

  recorder.start();

  const btn =
    $('#snapBtn');

  btn.textContent =
    '⏹ Stop Video';

  btn.onclick =
    () => {

      if (
        recorder &&
        recorder.state ===
          'recording'
      ) {

        recorder.stop();

      }
    };
}


/* =========================
   AUDIO
========================= */

async function toggleAudioRecord() {

  if (
    recorder &&
    recorder.state ===
      'recording'
  ) {

    recorder.stop();

    return;
  }

  try {

    stream =
      await navigator
        .mediaDevices
        .getUserMedia({
          audio: true
        });

    chunks = [];

    recorder =
      new MediaRecorder(stream);

    recorder.ondataavailable =
      e => {

        if (e.data.size) {

          chunks.push(e.data);

        }
      };

    recorder.onstop =
      async () => {

        captureBlob =
          new Blob(
            chunks,
            {
              type:
                recorder.mimeType ||
                'audio/webm'
            }
          );

        captureUrl =
          await blobToDataURL(
            captureBlob
          );

        stopStream();

        showCaptured(
          'audio'
        );
      };

    recorder.start();

    const btn =
      $('#audioRecordBtn');

    if (btn) {

      btn.textContent =
        '⏹ Stop Recording';

    }

    toast(
      'Recording started 🎙'
    );

  } catch (e) {

    toast(
      'Microphone permission allow karo.'
    );
  }
}


/* =========================
   CHOOSE FILE
========================= */

function fileChosen(f) {

  if (!f) return;

  let maxSize;

  if (currentType === 'photo') {
    maxSize = 10 * 1024 * 1024; // 10 MB
  } else if (currentType === 'video') {
    maxSize = 50 * 1024 * 1024; // 50 MB
  } else {
    maxSize = 20 * 1024 * 1024; // 20 MB audio
  }

  if (f.size > maxSize) {

    const limit =
      currentType === 'photo'
        ? '10MB'
        : currentType === 'video'
        ? '50MB'
        : '20MB';

    toast(
      `File bahut badi hai. ${limit} se chhoti file use karo.`
    );

    return;
  }

  captureBlob = f;

  captureUrl =
    URL.createObjectURL(f);

  showCaptured(
    currentType === 'photo'
      ? 'image'
      : currentType
  );
}

function showCaptured(kind) {

  const p =
    $('#preview');

  if (!p) return;

  if (
    kind === 'image'
  ) {

    p.innerHTML = `
      <img
        src="${captureUrl}"
        alt="Selected">
    `;

  } else if (
    kind === 'video'
  ) {

    p.innerHTML = `
      <video
        src="${captureUrl}"
        controls
        playsinline>
      </video>
    `;

  } else {

    p.innerHTML = `
      <audio
        src="${captureUrl}"
        controls>
      </audio>
    `;
  }
}

function blobToDataURL(b) {

  return new Promise(
    res => {

      const r =
        new FileReader();

      r.onload =
        () =>
          res(r.result);

      r.readAsDataURL(b);
    }
  );
}

function stopStream() {

  if (stream) {

    stream
      .getTracks()
      .forEach(
        t => t.stop()
      );

    stream = null;
  }
}

async function uploadChallengeMedia(file) {

  if (!file) return null;

  if (!currentUserId) {
    throw new Error('User login nahi hai.');
  }

  const mime = file.type || '';

  let extension = 'bin';

  if (mime.includes('jpeg')) extension = 'jpg';
  else if (mime.includes('png')) extension = 'png';
  else if (mime.includes('webp')) extension = 'webp';
  else if (mime.includes('mp4')) extension = 'mp4';
  else if (mime.includes('webm')) extension = 'webm';
  else if (mime.includes('mpeg')) extension = 'mp3';
  else if (mime.includes('wav')) extension = 'wav';

  const filePath =
    `${currentUserId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } =
    await supabaseClient.storage
      .from('challenge-media')
      .upload(
        filePath,
        file,
        {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        }
      );

  if (uploadError) {
    throw uploadError;
  }

  const { data } =
    supabaseClient.storage
      .from('challenge-media')
      .getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error('Media URL nahi mila.');
  }

  return data.publicUrl;
}

/* =========================
   PUBLISH
========================= */

async function publishChallenge(parentId) {

  const title =
    $('#titleInput')
      .value
      .trim();

  const text =
    $('#textInput')
      .value
      .trim();

  if (!title) {
    toast('Challenge title likho.');
    return;
  }

  if (
    currentType !== 'text' &&
    !captureUrl
  ) {
    toast('Photo, video ya audio add karo.');
    return;
  }

    let mediaUrl = null;

  if (
    currentType !== 'text' &&
    captureBlob
  ) {
    toast('Media upload ho raha hai...');

    mediaUrl =
      await uploadChallengeMedia(
        captureBlob
      );
  }

  const postBtn =
    $('#postBtn');

  if (postBtn) {
    postBtn.disabled = true;
    postBtn.textContent = 'Posting...';
  }

  try {

    /* Logged-in Supabase user */
    const {
      data: { user },
      error: userError
    } =
      await supabaseClient.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      toast('Pehle login karo.');
      showAuthScreen();
      return;
    }

    /* Local parent challenge */
    const parent =
      parentId
        ? state.challenges.find(
            c => c.id === parentId
          )
        : null;

    const generation =
      parent
        ? (parent.generation || 1) + 1
        : 1;

    /* Supabase UUID check */
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const realParentId =
      parentId &&
      uuidRegex.test(parentId)
        ? parentId
        : null;

    /* Save real challenge in Supabase */
    const {
      data: newChallenge,
      error: insertError
    } =
      await supabaseClient
        .from('challenges')
        .insert({
          creator_id: user.id,
          parent_id: realParentId,
          title: title,
          description: text,
          challenge_type: currentType,
          media_url: mediaUrl,
          generation: generation,
          attempts_count: 0,
          views_count: 0,
          status: 'active'
        })
        .select()
        .single();

    if (insertError) {
      throw insertError;
    }

    /* Local UI copy */
    const c = {

      id: newChallenge.id,

      creator: user.id,

      creatorName:
        profile().name,

      title: newChallenge.title,

      type:
        newChallenge.challenge_type,

      text:
        newChallenge.description || '',

      createdAt:
        new Date(
          newChallenge.created_at
        ).getTime(),

      parentId:
        newChallenge.parent_id,

      generation:
        newChallenge.generation || 1,

      likes: {},

      dislikes: {},

      comments: [],

      attempts:
        newChallenge.attempts_count || 0,

      tags:
        ($('#tagInput')?.value || '')
          .split(',')
          .map(x => x.trim())
          .filter(Boolean),

      media: mediaUrl
  ? {
      kind:
        currentType === 'photo'
          ? 'image'
          : currentType,
      data: mediaUrl
    }
  : null
    };

    state.challenges.unshift(c);

    /* Coins */
    const reward =
      parent ? 25 : 10;

    const newCoins =
      (profile().coins || 0) +
      reward;

    const {
      error: coinError
    } =
      await supabaseClient
        .from('profiles')
        .update({
          coins: newCoins
        })
        .eq(
          'id',
          user.id
        );

    if (!coinError) {
      profile().coins =
        newCoins;
    }

    if (parent) {

  const newAttempts =
    (parent.attempts || 0) + 1;

  const { error: attemptError } =
    await supabaseClient
      .from('challenges')
      .update({
        attempts_count: newAttempts
      })
      .eq('id', parent.id);

  if (attemptError) {
    throw attemptError;
  }

  parent.attempts = newAttempts;

  state.notifications.unshift({
        text:
          `Attempt posted. +${reward} coins 🔥`,
        time:
          Date.now(),
        read:
          false
      });

    } else {

      state.notifications.unshift({
        text:
          `Challenge created. +${reward} coins 🪙`,
        time:
          Date.now(),
        read:
          false
      });
    }

    save();

    captureBlob = null;
    captureUrl = '';

    toast(
      'Challenge database me post ho gaya 🔥'
    );

    go('home');

  } catch (error) {

    console.error(
      'Publish error:',
      error
    );

    toast(
      error.message ||
      'Challenge post nahi hua.'
    );

  } finally {

    if (postBtn) {
      postBtn.disabled = false;

      postBtn.textContent =
        parentId
          ? '🔥 Post Attempt'
          : '🚀 Publish Challenge';
    }
  }
}


/* =========================
   BEAT
========================= */

function openBeat(id) {

  renderCreate(id);
}


/* =========================
   COMMENTS
========================= */

function openComments(id) {

  const c =
    state.challenges.find(
      x => x.id === id
    );

  if (!c) return;

  modal.classList.remove(
    'hidden'
  );

  modalCard.innerHTML = `

    <div class="modal-head">

      <h3>
        Comments
      </h3>

      <button
        class="close"
        onclick="closeModal()">
        ×
      </button>

    </div>

    <div id="commentList">

      ${
        (c.comments || [])
          .map(
            x => `

              <div class="comment">

                <strong>
                  ${escapeHTML(x.name)}
                </strong>

                <span>
                  ${escapeHTML(x.text)}
                </span>

              </div>

            `
          )
          .join('')

        ||

        `
          <div class="empty">
            No comments yet.
          </div>
        `
      }

    </div>

    <div class="field">

      <textarea
        id="commentText"
        placeholder="Write a comment..."></textarea>

    </div>

    <button
      class="primary"
      style="width:100%"
      onclick="addComment('${id}')">

      Post Comment

    </button>
  `;
}

async function addComment(id) {
  const field = $('#commentText');
  if (!field) return;

  const txt = field.value.trim();

  if (!txt) {
    toast('Comment likho.');
    return;
  }

  try {
    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      toast('Pehle login karo.');
      return;
    }

    const { error } = await supabaseClient
      .from('comments')
      .insert({
        challenge_id: id,
        user_id: user.id,
        comment_text: txt
      });

    if (error) throw error;

    field.value = '';

    await loadCommentsFromSupabase();

    openComments(id);

  } catch (err) {
    console.error('Comment error:', err);
    toast(
      err.message ||
      'Comment save nahi hua.'
    );
  }
}

function closeModal() {

  modal.classList.add(
    'hidden'
  );

  stopStream();
}


/* =========================
   TAG FRIEND
========================= */

function tagFriend(id) {

  const c =
    state.challenges.find(
      x => x.id === id
    );

  if (!c) return;

  modal.classList.remove(
    'hidden'
  );

  modalCard.innerHTML = `

    <div class="modal-head">

      <h3>
        Tag a friend
      </h3>

      <button
        class="close"
        onclick="closeModal()">
        ×
      </button>

    </div>

    <p class="muted">

      Friend ka naam likho
      aur BeatTag challenge
      share karo.

    </p>

    <div class="field">

      <input
        id="friendName"
        placeholder="Friend name">

    </div>

    <button
      class="primary"
      style="width:100%"
      onclick="confirmTag('${id}')">

      👥 Tag & Share

    </button>
  `;
}

async function confirmTag(id) {
  const input = $('#friendName');

  if (!input) return;

  const name = input.value.trim();

  if (!name) {
    toast('Friend ka naam likho.');
    return;
  }

  const c =
    state.challenges.find(
      x => x.id === id
    );

  if (!c) return;

  try {
    const {
      data: { user },
      error: userError
    } =
      await supabaseClient.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      toast('Pehle login karo.');
      return;
    }

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (uuidPattern.test(id)) {
      const { error } =
        await supabaseClient
          .from('challenge_tags')
          .insert({
            challenge_id: id,
            tagged_by: user.id,
            tagged_user_id: null,
            tagged_name: name
          });

      if (error) {
        throw error;
      }
    }

    c.tags ||= [];

    if (!c.tags.includes(name)) {
      c.tags.push(name);

      profile().coins += 2;

      state.notifications.unshift({
        text: `${name} tagged. +2 coins 🪙`,
        time: Date.now(),
        read: false
      });
    }

    save();

    closeModal();

    toast(`${name} tagged 🔥`);

    shareChallenge(id);

  } catch (err) {
    console.error(
      'Tag friend error:',
      err
    );

    toast(
      err.message ||
      'Friend tag nahi hua.'
    );
  }
}


/* =========================
   SHARE
========================= */

async function shareChallenge(id) {

  const c =
    state.challenges.find(
      x => x.id === id
    );

  if (!c) return;

  const url =
    location.href
      .split('#')[0] +
    '#challenge=' +
    id;

  const text =
    `🔥 BeatTag Challenge\n\n${c.title}\n\nCan you beat it?`;

  try {

    if (
      navigator.share
    ) {

      await navigator.share({
        title:
          'BeatTag Challenge',
        text,
        url
      });

    } else if (
      navigator.clipboard
    ) {

      await navigator
        .clipboard
        .writeText(
          text +
          '\n' +
          url
        );

      toast(
        'Challenge link copied 🔗'
      );

    } else {

      window.prompt(
        'Copy this link:',
        url
      );
    }

  } catch (e) {

    console.log(
      'Share cancelled'
    );
  }
}


/* =========================
   CHAINS
========================= */
function renderChains() {

  const challenges = state.challenges || [];

  screenEl.innerHTML = `
    <div class="section-title">
      <h2>🔗 Challenge Chains</h2>
      <span class="muted">
        ${challenges.length}
      </span>
    </div>

    <div class="panel">
      <div
        class="chain-tree"
        id="tree">
      </div>
    </div>
  `;

  const tree = $('#tree');

  if (!challenges.length) {
    tree.innerHTML = `
      <div class="empty">
        No chains yet.
      </div>
    `;
    return;
  }

  // Root challenges = jinka parent nahi hai
  const roots = challenges.filter(
    c =>
      !c.parentId ||
      !challenges.some(
        x => x.id === c.parentId
      )
  );

  if (!roots.length) {
    tree.innerHTML = `
      <div class="empty">
        No connected chains found.
      </div>
    `;
    return;
  }

  tree.innerHTML = '';

  roots
    .slice()
    .sort(
      (a, b) =>
        a.createdAt - b.createdAt
    )
    .forEach(root => {

      const chainBox =
        document.createElement('div');

      chainBox.className =
        'chain-group';

      renderChainNode(
        root,
        chainBox,
        0
      );

      tree.appendChild(chainBox);
    });
}


function renderChainNode(
  challenge,
  container,
  level = 0
) {

  const children =
    state.challenges
      .filter(
        c =>
          c.parentId === challenge.id
      )
      .sort(
        (a, b) =>
          (a.createdAt || 0) -
          (b.createdAt || 0)
      );

  const node =
    document.createElement('div');

  node.className =
    'chain-node';

  node.style.marginLeft =
    `${Math.min(level, 6) * 18}px`;

  node.innerHTML = `
  <div class="chain-card">

    <div class="chain-card-top">

      <div class="avatar">
        ${
          (
            challenge.creatorName ||
            '?'
          )[0].toUpperCase()
        }
      </div>

      <div class="chain-card-info">

        <div class="chain-gen-badge">
          Gen ${challenge.generation || 1}
        </div>

        <strong class="chain-title">
          ${escapeHTML(
            challenge.title ||
            'Untitled Challenge'
          )}
        </strong>

        <div class="chain-creator">
          by ${escapeHTML(
            challenge.creatorName ||
            'BeatTag User'
          )}
        </div>

      </div>

    </div>

    <div class="chain-stats">
      🔗 ${children.length}
      ${
        children.length === 1
          ? 'attempt'
          : 'attempts'
      }
    </div>

  </div>
`;

  container.appendChild(node);
if (children.length) {

  const branchWrap =
    document.createElement('div');

  branchWrap.className =
    children.length > 1
      ? 'chain-children branch'
      : 'chain-children';

  children.forEach(child => {

    const childWrap =
      document.createElement('div');

    childWrap.className =
      'chain-child';

    renderChainNode(
      child,
      childWrap,
      level + 1
    );

    branchWrap.appendChild(
      childWrap
    );
  });

  container.appendChild(
    branchWrap
  );
}

}

/* =========================
   PROFILE
========================= */

function renderProfile() {

  const p =
    profile();

  const mine =
  state.challenges.filter(
    c =>
      c.creator === currentUserId
  );
  const likes =
    mine.reduce(
      (s, c) =>
        s +
        Object.keys(
          c.likes || {}
        ).length,
      0
    );

  const attempts =
    mine.reduce(
      (s, c) =>
        s +
        (c.attempts || 0),
      0
    );

  const maxGen =
    Math.max(
      1,
      ...mine.map(
        c => c.generation
      )
    );

  const owned =
    SHOP.filter(
      item =>
        isOwned(item.id)
    ).length;

  screenEl.innerHTML = `

    <section
      class="panel profile-head">

      <div class="profile-avatar">
        ${escapeHTML(p.name)[0] || 'M'}
      </div>

      <h2>
        ${escapeHTML(p.name)}
      </h2>

      <div class="muted">
        ${escapeHTML(p.handle)}
      </div>

      <div style="margin-top:9px">

        <span class="badge">
          🔥 ${p.streak} day streak
        </span>

        <span class="badge">
          🪙 ${p.coins} coins
        </span>

        <span class="badge">
          🎁 ${owned} items
        </span>

      </div>

      <button
        class="secondary"
        style="margin-top:12px"
        onclick="editProfile()">

        Edit Profile

      </button>
      <button
  class="secondary"
  style="margin-top:10px; width:100%;"
  onclick="logoutBeatTag()">

  🚪 Logout

</button>

    </section>


    <div class="grid">

      <div class="stat">

        <strong>
          ${mine.length}
        </strong>

        <span>
          Challenges
        </span>

      </div>

      <div class="stat">

        <strong>
          ${attempts}
        </strong>

        <span>
          Attempts
        </span>

      </div>

      <div class="stat">

        <strong>
          ${likes}
        </strong>

        <span>
          Likes received
        </span>

      </div>

      <div class="stat">

        <strong>
          ${maxGen}
        </strong>

        <span>
          Longest generation
        </span>

      </div>

    </div>

    ${isAdmin ? `
  <section class="panel" style="margin-bottom:16px;">
    <h3>🛡️ Admin Panel</h3>

    <button
      class="primary"
      style="width:100%; margin-top:10px;"
      onclick="renderAdminReports()">
      🚩 View Reports
    </button>
  </section>
` : ''}


    <div class="section-title">
    <section class="panel" style="margin-bottom:16px;">
  <h3 style="margin-bottom:12px;">ℹ️ BeatTag Info</h3>

  <div style="display:flex; flex-direction:column; gap:10px;">

    <a href="about.html" class="secondary"
       style="display:block;text-decoration:none;padding:12px;">
      ℹ️ About
    </a>

    <a href="contact.html" class="secondary"
       style="display:block;text-decoration:none;padding:12px;">
      ✉️ Contact
    </a>

    <a href="community-guidelines.html" class="secondary"
       style="display:block;text-decoration:none;padding:12px;">
      👥 Community Guidelines
    </a>

    <a href="privacy.html" class="secondary"
       style="display:block;text-decoration:none;padding:12px;">
      🔒 Privacy Policy
    </a>

    <a href="terms.html" class="secondary"
       style="display:block;text-decoration:none;padding:12px;">
      📄 Terms & Conditions
    </a>

  </div>
</section>

      <h2>
        My Challenges
      </h2>

      <button
        class="ghost"
        onclick="go('shop')">
        🛍 Shop
      </button>

    </div>

    <div id="myFeed"></div>
    
  `;

  const f =
    $('#myFeed');

  if (!mine.length) {

    f.innerHTML = `
      <div class="empty">

        Create your
        first challenge.

      </div>
    `;

  } else {

    mine.forEach(
      c =>
        f.appendChild(
          challengeCard(c)
        )
    );
  }
}

async function renderAdminReports() {

  if (!isAdmin) {
    toast('Admin access required.');
    return;
  }

  screenEl.innerHTML = `
    <section class="panel">
      <div class="section-title">
        <h2>🚩 Reported Challenges</h2>

        <button
          class="ghost"
          onclick="renderProfile()">
          ← Back
        </button>
      </div>

      <div id="adminReports">
        <div class="empty">
          Loading reports...
        </div>
      </div>
    </section>
  `;

  const box =
    document.getElementById('adminReports');

  try {

    const { data, error } =
      await supabaseClient
        .from('reports')
        .select(`
          id,
          challenge_id,
          reported_by,
          reason,
          details,
          status,
          created_at,
          challenges (
            id,
            title,
            description,
            creator_id,
            status
          )
        `)
        .eq('status', 'pending')
        .order('created_at', {
          ascending: false
        });

    if (error) throw error;

    if (!data || !data.length) {
      box.innerHTML = `
        <div class="empty">
          ✅ No pending reports
        </div>
      `;
      return;
    }

    box.innerHTML =
      data.map(report => {

        const challenge =
          report.challenges;

        return `
          <div
            class="panel"
            style="margin-top:14px;">

            <div class="badge">
              🚩 ${escapeHTML(
                report.reason || 'Report'
              )}
            </div>

            <h3 style="margin-top:10px;">
              ${escapeHTML(
                challenge?.title ||
                'Challenge unavailable'
              )}
            </h3>

            ${
              challenge?.description
                ? `
                  <p class="muted">
                    ${escapeHTML(
                      challenge.description
                    )}
                  </p>
                `
                : ''
            }

            ${
              report.details
                ? `
                  <p style="margin-top:10px;">
                    <strong>Report details:</strong>
                    ${escapeHTML(report.details)}
                  </p>
                `
                : ''
            }

            <div
              class="muted"
              style="margin-top:8px;">

              ${new Date(
                report.created_at
              ).toLocaleString()}

            </div>

            <div
              style="
                display:flex;
                gap:8px;
                margin-top:14px;
                flex-wrap:wrap;
              ">

              <button
                class="primary"
                onclick="adminRemoveChallenge(
                  '${report.id}',
                  '${report.challenge_id}'
                )">
                🗑 Remove Challenge
              </button>

              <button
                class="secondary"
                onclick="adminDismissReport(
                  '${report.id}'
                )">
                ✅ Dismiss Report
              </button>

            </div>

          </div>
        `;
      }).join('');

  } catch (err) {

    console.error(
      'Load admin reports error:',
      err
    );

    box.innerHTML = `
      <div class="empty">
        Reports load nahi hue.
      </div>
    `;
  }
}


async function adminDismissReport(
  reportId
) {

  if (!isAdmin) return;

  try {

    const { error } =
      await supabaseClient
        .from('reports')
        .update({
          status: 'dismissed'
        })
        .eq('id', reportId);

    if (error) throw error;

    toast('Report dismissed ✅');

    await renderAdminReports();

  } catch (err) {

    console.error(
      'Dismiss report error:',
      err
    );

    toast(
      err.message ||
      'Report dismiss nahi hua.'
    );
  }
}


async function adminRemoveChallenge(
  reportId,
  challengeId
) {

  if (!isAdmin) return;

  const ok =
    confirm(
      'Is challenge ko BeatTag se remove karna hai?'
    );

  if (!ok) return;

  try {

    const { error: challengeError } =
      await supabaseClient
        .from('challenges')
        .update({
          status: 'removed'
        })
        .eq('id', challengeId);

    if (challengeError) {
      throw challengeError;
    }

    const { error: reportError } =
      await supabaseClient
        .from('reports')
        .update({
          status: 'actioned'
        })
        .eq('id', reportId);

    if (reportError) {
      throw reportError;
    }

    await loadChallengesFromSupabase();

    toast('Challenge removed 🗑');

    await renderAdminReports();

  } catch (err) {

    console.error(
      'Admin remove challenge error:',
      err
    );

    toast(
      err.message ||
      'Challenge remove nahi hua.'
    );
  }
}

function editProfile() {

  const p =
    profile();

  modal.classList.remove(
    'hidden'
  );

  modalCard.innerHTML = `

    <div class="modal-head">

      <h3>
        Edit Profile
      </h3>

      <button
        class="close"
        onclick="closeModal()">
        ×
      </button>

    </div>

    <div class="field">

      <label>
        Name
      </label>

      <input
        id="epName"
        value="${escapeAttr(p.name)}">

    </div>

    <div class="field">

      <label>
        Handle
      </label>

      <input
        id="epHandle"
        value="${escapeAttr(p.handle)}">

    </div>

    <button
      class="primary"
      style="width:100%"
      onclick="saveProfile()">

      Save

    </button>
  `;
}

function saveProfile() {

  const p =
    profile();

  p.name =
    $('#epName')
      .value
      .trim() ||
    p.name;

  p.handle =
    $('#epHandle')
      .value
      .trim() ||
    p.handle;

  if (
    !p.handle.startsWith('@')
  ) {

    p.handle =
      '@' + p.handle;
  }

  save();

  closeModal();

  renderProfile();

  toast(
    'Profile updated ✅'
  );
}


/* =========================
   SHOP ITEMS
========================= */

const SHOP = [

  {
    id: 'firepack',
    icon: '🔥',
    name:
      'Fire Reaction Pack',
    desc:
      'Special fiery reactions',
    cost: 100,
    duration:
      '7 days',
    featured: true
  },

  {
    id: 'frame',
    icon: '⚡',
    name:
      'Neon Profile Frame',
    desc:
      'Premium neon profile frame',
    cost: 300,
    duration:
      '30 days',
    featured: true
  },

  {
    id: 'theme',
    icon: '🌌',
    name:
      'Galaxy Challenge Theme',
    desc:
      'Galaxy-style challenge cards',
    cost: 220,
    duration:
      '14 days',
    featured: true
  },

  {
    id: 'sticker',
    icon: '😎',
    name:
      'Sticker Pack',
    desc:
      'Extra fun stickers',
    cost: 140,
    duration:
      '30 days'
  },

  {
    id: 'trophy',
    icon: '🏆',
    name:
      'Legend Trophy',
    desc:
      'Permanent collectible trophy',
    cost: 1200,
    duration:
      'Permanent'
  },

  {
    id: 'confetti',
    icon: '🎉',
    name:
      'Victory Effect',
    desc:
      'Celebration effect after a win',
    cost: 180,
    duration:
      '7 days'
  },

  {
    id: 'crown',
    icon: '👑',
    name:
      'Royal Crown',
    desc:
      'Special profile collectible',
    cost: 500,
    duration:
      'Permanent'
  },

  {
    id: 'lightning',
    icon: '⚡',
    name:
      'Lightning Reaction',
    desc:
      'Rare reaction cosmetic',
    cost: 160,
    duration:
      '14 days'
  }
];


/* =========================
   SHOP
========================= */

function renderShop() {

  screenEl.innerHTML = `

    <section class="shop-hero">

      <h2>
        🛍 BeatTag Shop
      </h2>

      <p>

        Challenges free hain.
        Coins se sirf cosmetic
        aur fun items unlock karo.

      </p>

      <div class="shop-balance">
        🪙 ${profile().coins} Coins
      </div>

    </section>


    <div class="section-title">

      <h2>
        ⭐ Featured Items
      </h2>

      <span class="muted">
        Popular
      </span>

    </div>

    <div
      class="shop-grid"
      id="featuredShop">
    </div>


    <div class="section-title">

      <h2>
        All Items
      </h2>

      <span class="muted">
        ${SHOP.length} items
      </span>

    </div>

    <div
      class="shop-grid"
      id="shop">
    </div>
  `;

  const featured =
    $('#featuredShop');

  const all =
    $('#shop');

  SHOP
    .filter(
      it => it.featured
    )
    .forEach(
      it =>
        renderShopItem(
          featured,
          it,
          true
        )
    );

  SHOP.forEach(
    it =>
      renderShopItem(
        all,
        it,
        false
      )
  );
}

function renderShopItem(
  container,
  it,
  featured
) {

  const owned =
    isOwned(it.id);

  container.insertAdjacentHTML(
    'beforeend',
    `

      <div
        class="shop-item
        ${featured
          ? 'featured-item'
          : ''}">

        ${
          featured
            ? `
              <span
                class="shop-featured-label">
                FEATURED
              </span>
            `
            : ''
        }

        <div class="shop-icon">
          ${it.icon}
        </div>

        <h3>
          ${it.name}
        </h3>

        <p>

          ${it.desc}

          <br>

          ${it.duration}

        </p>

        <button
          class="${
            owned
              ? 'secondary'
              : 'primary'
          }"

          ${
            owned
              ? 'disabled'
              : ''
          }

          onclick="buyItem('${it.id}')">

          ${
            owned
              ? '✓ Unlocked'
              : `🪙 ${it.cost}`
          }

        </button>

      </div>
    `
  );
}

function isOwned(id) {

  const x =
    state.purchases.find(
      p =>
        p.profile ===
          state.currentProfile
        &&
        p.item === id
    );

  if (!x) return false;

  if (!x.expiresAt) {
    return true;
  }

  return (
    x.expiresAt >
    Date.now()
  );
}

function buyItem(id) {

  const it =
    SHOP.find(
      x => x.id === id
    );

  const p =
    profile();

  if (!it) return;

  if (isOwned(id)) {

    toast(
      'Already unlocked ✅'
    );

    return;
  }

  if (
    p.coins < it.cost
  ) {

    toast(
      'Not enough coins 🪙'
    );

    return;
  }

  p.coins -=
    it.cost;

  let exp = null;

  if (
    it.duration.includes(
      '7 days'
    )
  ) {

    exp =
      Date.now() +
      7 * 864e5;
  }

  if (
    it.duration.includes(
      '14 days'
    )
  ) {

    exp =
      Date.now() +
      14 * 864e5;
  }

  if (
    it.duration.includes(
      '30 days'
    )
  ) {

    exp =
      Date.now() +
      30 * 864e5;
  }

  state.purchases.push({

    profile:
      p.id,

    item:
      id,

    boughtAt:
      Date.now(),

    expiresAt:
      exp
  });

  state.notifications.unshift({

    text:
      `${it.name} unlocked 🎁`,

    time:
      Date.now(),

    read:
      false
  });

  save();

  toast(
    it.name +
    ' unlocked 🎉'
  );

  renderShop();
}


/* =========================
   NOTIFICATIONS
========================= */

function openNotifications() {

  state.notifications
    .forEach(
      n => {
        n.read = true;
      }
    );

  save();

  modal.classList.remove(
    'hidden'
  );

  modalCard.innerHTML = `

    <div class="modal-head">

      <h3>
        🔔 Notifications
      </h3>

      <button
        class="close"
        onclick="closeModal()">
        ×
      </button>

    </div>

    ${
      state.notifications
        .map(
          n => `

            <div class="comment">

              <strong>
                ${escapeHTML(n.text)}
              </strong>

              <span>
                ${fmt(n.time)}
              </span>

            </div>

          `
        )
        .join('')

      ||

      `
        <div class="empty">
          No notifications.
        </div>
      `
    }
  `;
}


/* =========================
   SECURITY
========================= */

function escapeHTML(s = '') {

  return String(s)
    .replace(
      /[&<>"']/g,
      m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m])
    );
}

function escapeAttr(s = '') {

  return escapeHTML(s);
}


/* =========================
   SHARED CHALLENGE LINK
========================= */

function checkSharedChallenge() {

  const m =
    location.hash.match(
      /challenge=([^&]+)/
    );

  if (!m) return;

  const id =
    decodeURIComponent(
      m[1]
    );

  const c =
    state.challenges.find(
      x => x.id === id
    );

  if (c) {

    renderHome();

    setTimeout(
      () => {

        toast(
          'Challenge opened: ' +
          c.title
        );

      },
      150
    );
  }
}

window.addEventListener(
  'hashchange',
  checkSharedChallenge
);


/* =========================
   START APP
========================= */

updateCoins();
updateNotificationDot();

go('home');

checkSharedChallenge();
// ===============================
// BEATTAG SUPABASE REALTIME
// ===============================

const beatTagRealtime = supabaseClient
  .channel('beattag-live')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'challenges'
    },
    async () => {
      await loadChallengesFromSupabase();
      go('home');
    }
  )
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'reactions'
    },
    async () => {
      await loadReactionsFromSupabase();
      renderHome();
    }
  )
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'comments'
    },
    async () => {
      await loadCommentsFromSupabase();
      renderHome();
    }
  )
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'challenge_tags'
    },
    async () => {
      await loadTagsFromSupabase();
      renderHome();
    }
  )
  .subscribe((status) => {
    console.log('BeatTag Realtime:', status);
  });
