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
let followingIds = new Set();
let shopInventory = new Map();

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
    message.textContent = "Email and password are required.";
    return;
  }

  if (password.length < 6) {
    message.textContent = "Password must be at least 6 characters.";
    return;
  }

  button.disabled = true;
  button.textContent = "Please wait...";

  try {
    if (authMode === "signup") {
      if (!name || !username) {
        message.textContent = "Enter your name and username.";
        return;
      }

      const cleanUsername = username
        .replace(/^@/, "")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");

      if (cleanUsername.length < 3) {
        message.textContent = "Username must be at least 3 characters.";
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
          "Account created ✅ Check your inbox or spam folder for the verification link.";
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
  const profileReady = await loadRealProfile();
  if (profileReady === false) return;
  await checkAdmin();
  await loadFollowing();
  await loadShopInventory();

  await loadChallengesFromSupabase();

  await Promise.all([
    loadReactionsFromSupabase(),
    loadCommentsFromSupabase(),
    loadTagsFromSupabase()
  ]);

  showApp();

  if (currentTab === 'home') {
    renderHome();
  } else {
    go(currentTab);
  }
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
      localProfile.websiteUrl1 = profile.website_url_1 || "";
      localProfile.websiteUrl2 = profile.website_url_2 || "";
      localProfile.equippedFrame = profile.equipped_frame || "";
      localProfile.equippedBadge = profile.equipped_badge || "";
      localProfile.equippedTheme = profile.equipped_theme || "";
      localProfile.dailyRewardClaimedAt = profile.daily_reward_claimed_at ? new Date(profile.daily_reward_claimed_at).getTime() : 0;

      const suspendedUntil = profile.suspended_until
        ? new Date(profile.suspended_until).getTime()
        : 0;

      if (profile.is_banned || suspendedUntil > Date.now()) {
        const reason = profile.moderation_reason || "Community Guidelines violation";
        const message = profile.is_banned
          ? `This BeatTag account is banned. ${reason}`
          : `This BeatTag account is suspended until ${new Date(suspendedUntil).toLocaleString()}. ${reason}`;

        await supabaseClient.auth.signOut();
        showAuthScreen();
        const authMessage = document.getElementById("authMessage");
        if (authMessage) authMessage.textContent = message;
        return false;
      }

      save();

      const coinEl = document.getElementById("coinCount");
      if (coinEl) coinEl.textContent = localProfile.coins;
    }

    return true;
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

    if (!challenges || !challenges.length) {
  state.challenges = [];
  save();
  return;
}
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
          .select("*")
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
        boostedUntil: c.boosted_until ? new Date(c.boosted_until).getTime() : 0,
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
      'Storage is full. The large photo or video could not be saved in your browser.'
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

let currentTab = 'home';
let currentFeedMode = 'all';
let exploreSearchTimer = null;
let searchRequestToken = 0;
function go(tab) {
currentTab = tab;
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
   FOLLOW SYSTEM
========================= */

async function loadFollowing() {
  followingIds = new Set();
  if (!currentUserId) return;

  try {
    const { data, error } = await supabaseClient
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);

    if (error) throw error;
    (data || []).forEach(row => followingIds.add(row.following_id));
  } catch (err) {
    console.warn('Follow system unavailable:', err?.message || err);
  }
}

function isFollowing(userId) {
  return !!userId && followingIds.has(userId);
}

async function toggleFollow(userId, fallbackName = 'BeatTag User') {
  if (!currentUserId) {
    toast('Please log in first.');
    return;
  }

  if (!userId || userId === currentUserId) return;

  const alreadyFollowing = isFollowing(userId);

  try {
    if (alreadyFollowing) {
      const { error } = await supabaseClient
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', userId);
      if (error) throw error;
      followingIds.delete(userId);
      toast('Unfollowed.');
    } else {
      const { error } = await supabaseClient
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: userId });
      if (error) throw error;
      followingIds.add(userId);
      toast('Following ✓');
    }

    if (currentTab === 'public-profile') {
      await renderPublicProfile(userId, fallbackName);
    } else if (currentTab === 'home' && currentFeedMode === 'friends') {
      renderFeed('friends');
    }
  } catch (err) {
    console.error('Follow error:', err);
    toast(err?.message || 'Could not update follow status. Run the BeatTag V2 database upgrade first.');
  }
}

function creatorLeaderboard(limit = 20) {
  const map = new Map();

  state.challenges.forEach(c => {
    if (!c.creator) return;
    const entry = map.get(c.creator) || {
      id: c.creator,
      name: c.creatorName || 'BeatTag User',
      posts: 0,
      likes: 0,
      attempts: 0,
      score: 0
    };

    const likes = Object.keys(c.likes || {}).length;
    const comments = (c.comments || []).length;
    const attempts = c.attempts || 0;

    entry.posts += 1;
    entry.likes += likes;
    entry.attempts += attempts;
    entry.score += likes * 3 + comments * 2 + attempts * 4 + (c.generation || 1);
    map.set(c.creator, entry);
  });

  return [...map.values()]
    .sort((a, b) => b.score - a.score || b.likes - a.likes || b.attempts - a.attempts)
    .slice(0, limit);
}

function renderLeaderboard() {
  currentTab = 'leaderboard';
  stopStream();
  const leaders = creatorLeaderboard(50);

  screenEl.innerHTML = `
    <div class="section-title leaderboard-title-row">
      <div>
        <div class="eyebrow">COMMUNITY RANKING</div>
        <h2>Leaderboard</h2>
      </div>
      <button class="ghost" onclick="go('explore')">← Explore</button>
    </div>

    <section class="leaderboard-hero">
      <div class="leaderboard-orb">✦</div>
      <div>
        <strong>Top BeatTag Creators</strong>
        <p>Ranked by challenge activity, likes, comments, attempts and chain growth.</p>
      </div>
    </section>

    <div class="leaderboard-list" id="leaderboardList"></div>
  `;

  const list = $('#leaderboardList');
  if (!leaders.length) {
    list.innerHTML = '<div class="empty">No leaderboard data yet.</div>';
    return;
  }

  leaders.forEach((creator, index) => {
    const row = document.createElement('button');
    row.className = `leaderboard-row ${index < 3 ? 'top-three' : ''}`;
    row.type = 'button';
    row.onclick = () => renderPublicProfile(creator.id, creator.name);
    row.innerHTML = `
      <span class="leaderboard-rank">${index + 1}</span>
      <span class="leaderboard-avatar">${escapeHTML(creator.name)[0] || 'B'}</span>
      <span class="leaderboard-person">
        <strong>${escapeHTML(creator.name)}</strong>
        <small>${creator.posts} challenges · ${creator.likes} likes · ${creator.attempts} attempts</small>
      </span>
      <span class="leaderboard-score">${creator.score}<small>PTS</small></span>
    `;
    list.appendChild(row);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
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
        class="pill ${currentFeedMode === 'all' ? 'active' : ''}"
        onclick="renderFeed('all',this)">
        For You
      </button>

      <button
        class="pill ${currentFeedMode === 'trending' ? 'active' : ''}"
        onclick="renderFeed('trending',this)">
        🔥 Trending
      </button>

      <button
        class="pill ${currentFeedMode === 'friends' ? 'active' : ''}"
        onclick="renderFeed('friends',this)">
        Following
      </button>

      <button
        class="pill ${currentFeedMode === 'new' ? 'active' : ''}"
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

  renderFeed(currentFeedMode);
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
        No featured challenges yet.
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

function sortFeedByBoostAndTime(arr) {
  return arr.sort((a, b) => {
    const aBoosted = Number((a.boostedUntil || 0) > Date.now());
    const bBoosted = Number((b.boostedUntil || 0) > Date.now());
    return (bBoosted - aBoosted) || ((b.createdAt || 0) - (a.createdAt || 0));
  });
}

function renderFeed(
  mode = 'all',
  button = null
) {
  currentFeedMode = mode;

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

    sortFeedByBoostAndTime(arr);

  } else if (mode === 'friends') {

    arr = arr.filter(c => followingIds.has(c.creator));
    sortFeedByBoostAndTime(arr);

  } else {

    sortFeedByBoostAndTime(arr);
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
    `${fmt(c.createdAt)} • Generation ${c.generation}${(c.boostedUntil || 0) > Date.now() ? ' • ⚡ Boosted' : ''}`;

  n.querySelector(
    '.challenge-title'
  ).textContent =
    c.title;

  const descriptionEl =
    n.querySelector('.challenge-description');

  if (descriptionEl) {
    const description = c.type === 'text' ? '' : (c.text || '').trim();
    descriptionEl.textContent = description;
    descriptionEl.classList.toggle('hidden', !description);
  }

  n.querySelector(
    '.media-wrap'
  ).innerHTML =
    mediaHTML(c);

  const creatorNameEl = n.querySelector('.creatorName');
  const avatarEl = n.querySelector('.avatar');

  const openCreatorProfile = () => {
    if (c.creator) renderPublicProfile(c.creator, c.creatorName);
  };

  if (creatorNameEl) {
    creatorNameEl.classList.add('profile-link');
    creatorNameEl.onclick = openCreatorProfile;
  }

  if (avatarEl) {
    avatarEl.classList.add('profile-link');
    avatarEl.onclick = openCreatorProfile;
  }

  const like =
    n.querySelector('.likeBtn');

  const dis =
    n.querySelector(
      '.dislikeBtn'
    );

  const pid =
    currentUserId || state.currentProfile;

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
    toast('You can only edit your own challenge.');
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
    toast('Challenge title cannot be empty.');
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
      'Could not edit the challenge.'
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
    toast('You cannot report your own challenge.');
    return;
  }

  modal.classList.remove('hidden');

  modalCard.innerHTML = `
  <div style="
    background:linear-gradient(180deg,#17111f 0%,#100c17 100%);
    border:1px solid #7c3cff;
    border-radius:24px;
    padding:22px;
    box-shadow:0 0 30px rgba(179,60,255,.18);
  ">

    <div class="modal-head">
      <h3 style="
        margin:0;
        font-size:24px;
        display:flex;
        align-items:center;
        gap:10px;
      ">
        🚩 Report Challenge
      </h3>

      <button
        class="close"
        onclick="closeModal()"
        style="
          background:transparent;
          border:none;
          color:#fff;
          font-size:28px;
        ">
        ×
      </button>
    </div>

    <p style="
      margin:12px 0 16px;
      color:#b9afc6;
      line-height:1.5;
    ">
      Help us keep BeatTag safe and fun for everyone.
    </p>

    <div style="
      background:#181222;
      border:1px solid #332640;
      border-radius:16px;
      padding:14px;
      margin-bottom:20px;
      color:#c7bdd2;
      line-height:1.45;
    ">
      🟣 Your report is confidential. We'll review it and take action if it violates our guidelines.
    </div>

    <label style="
      display:block;
      color:#fff;
      font-weight:700;
      margin-bottom:8px;
    ">
      Reason for reporting <span style="color:#ff4d7d;">*</span>
    </label>

    <select
      id="reportReason"
      style="
        width:100%;
        background:#15101d;
        color:#fff;
        border:1px solid #8a4cff;
        border-radius:14px;
        padding:14px 16px;
        font-size:16px;
        outline:none;
        margin-bottom:18px;
      ">
      <option value="">Select reason</option>
      <option value="spam">🚫 Spam</option>
      <option value="harassment">💬 Harassment or Bullying</option>
      <option value="adult">🔞 Adult / Sexual Content</option>
      <option value="graphic">🩸 Graphic / Gore Content</option>
      <option value="inappropriate">⚠️ Inappropriate Content</option>
      <option value="dangerous">🚩 Harmful or Dangerous Challenge</option>
      <option value="other">••• Other</option>
    </select>

    <label style="
      display:block;
      color:#fff;
      font-weight:700;
      margin-bottom:8px;
    ">
      Additional details
      <span style="color:#8f859b;font-weight:400;">
        (optional)
      </span>
    </label>

    <textarea
      id="reportDetails"
      maxlength="200"
      placeholder="Tell us more about why you are reporting this challenge..."
      style="
        width:100%;
        min-height:120px;
        box-sizing:border-box;
        resize:vertical;
        background:#15101d;
        color:#fff;
        border:1px solid #4b3b5a;
        border-radius:14px;
        padding:14px;
        font-size:16px;
        line-height:1.5;
        outline:none;
        margin-bottom:18px;
      "></textarea>

    <button
      class="primary"
      style="
        width:100%;
        border:none;
        border-radius:16px;
        padding:16px;
        font-size:17px;
        font-weight:800;
        background:linear-gradient(90deg,#7b2cff,#ef24d5);
        color:#fff;
        box-shadow:0 8px 24px rgba(193,42,255,.25);
      "
      onclick="submitChallengeReport('${id}')">
      🚩 Submit Report
    </button>

  </div>
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
    toast('Select a report reason.');
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
        toast('You have already reported this challenge.');
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
      'Could not submit the report.'
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
    toast('You can only delete your own challenge.');
    return;
  }

  const ok = confirm(
    `Delete "${challenge.title}"?\n\nThis action cannot be undone.`
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
          'Could not find the stored media path.'
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
      'Could not delete the challenge.'
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
      toast('Please log in first.');
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
      'Could not save your reaction.'
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
        Top challenges are ranked using likes, comments, attempts and challenge-chain growth.
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
    <div class="explore-heading">
      <div>
        <div class="eyebrow">DISCOVER BEATTAG</div>
        <h2>Explore</h2>
        <p>Find creators, challenges and the next chain worth beating.</p>
      </div>
      <button class="leaderboard-quick-btn" onclick="renderLeaderboard()">
        <span>♕</span>
        <span><strong>Leaderboard</strong><small>Top creators</small></span>
        <b>›</b>
      </button>
    </div>

    <div class="search-shell">
      <span class="search-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
      </span>
      <input id="search" autocomplete="off" placeholder="Search challenges or creators..." aria-label="Search BeatTag">
      <button class="search-clear hidden" id="searchClear" type="button" aria-label="Clear search">×</button>
    </div>

    <div class="pills explore-filters">
      <button class="pill active" data-filter="all">All</button>
      <button class="pill" data-filter="people">Creators</button>
      <button class="pill" data-filter="photo">Photo</button>
      <button class="pill" data-filter="video">Video</button>
      <button class="pill" data-filter="audio">Audio</button>
      <button class="pill" data-filter="text">Text</button>
    </div>

    <div id="results"></div>
  `;

  const search = $('#search');
  const clear = $('#searchClear');

  search.addEventListener('input', () => {
    clear.classList.toggle('hidden', !search.value);
    clearTimeout(exploreSearchTimer);
    exploreSearchTimer = setTimeout(() => doSearch(), 140);
  });

  clear.onclick = () => {
    search.value = '';
    clear.classList.add('hidden');
    search.focus();
    doSearch();
  };

  document.querySelectorAll('[data-filter]').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('[data-filter]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      doSearch(b.dataset.filter);
    };
  });

  doSearch('all');
}

async function doSearch(typeFilter = null) {
  const requestToken = ++searchRequestToken;
  const q = ($('#search')?.value || '').trim().toLowerCase();
  const active = document.querySelector('[data-filter].active');
  const filter = typeFilter || active?.dataset.filter || 'all';
  const out = $('#results');
  if (!out) return;

  const challengeMatches = state.challenges.filter(c => {
    const haystack = `${c.title} ${c.text || ''} ${c.creatorName || ''}`.toLowerCase();
    const textMatch = !q || haystack.includes(q);
    const typeMatch = filter === 'all' || filter === 'people' ? true : c.type === filter;
    return textMatch && typeMatch && filter !== 'people';
  });

  let people = [];
  if (filter === 'all' || filter === 'people') {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('id,name,username,bio')
        .limit(80);
      if (error) throw error;

      if (requestToken !== searchRequestToken) return;

      people = (data || []).filter(person => {
        if (!q) return filter === 'people';
        const haystack = `${person.name || ''} ${person.username || ''} ${person.bio || ''}`.toLowerCase();
        return haystack.includes(q);
      }).slice(0, q ? 12 : 8);
    } catch (err) {
      console.warn('Creator search unavailable:', err?.message || err);
    }
  }

  out.innerHTML = '';

  if (people.length) {
    const section = document.createElement('section');
    section.className = 'search-people-section';
    section.innerHTML = `<div class="search-result-heading"><strong>Creators</strong><span>${people.length}</span></div>`;
    const grid = document.createElement('div');
    grid.className = 'creator-search-list';

    people.forEach(person => {
      const name = person.name || person.username || 'BeatTag User';
      const username = person.username ? '@' + String(person.username).replace(/^@/, '') : '';
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'creator-search-row';
      row.onclick = () => renderPublicProfile(person.id, name);
      row.innerHTML = `
        <span class="creator-search-avatar">${escapeHTML(name)[0] || 'B'}</span>
        <span class="creator-search-copy">
          <strong>${escapeHTML(name)}</strong>
          <small>${escapeHTML(username || 'BeatTag creator')}</small>
        </span>
        ${person.id !== currentUserId ? `<span class="creator-follow-state">${isFollowing(person.id) ? 'Following' : 'View'}</span>` : '<span class="creator-follow-state">You</span>'}
        <span class="creator-search-arrow">›</span>
      `;
      grid.appendChild(row);
    });

    section.appendChild(grid);
    out.appendChild(section);
  }

  if (challengeMatches.length) {
    const heading = document.createElement('div');
    heading.className = 'search-result-heading challenge-result-heading';
    heading.innerHTML = `<strong>Challenges</strong><span>${challengeMatches.length}</span>`;
    out.appendChild(heading);
    challengeMatches.forEach(c => out.appendChild(challengeCard(c)));
  }

  if (!people.length && !challengeMatches.length) {
    out.innerHTML = `
      <div class="empty premium-empty">
        <span>⌕</span>
        <strong>No results found</strong>
        <small>Try another creator name, keyword or challenge type.</small>
      </div>
    `;
  }
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
        'Camera is not available in this browser.'
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
      'Allow camera permission or use Choose File.'
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
      'Could not start the camera.'
    );

    return;
  }

  if (
    typeof MediaRecorder ===
    'undefined'
  ) {

    toast(
      'This browser does not support video recording. Use Choose File instead.'
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
      'Allow microphone permission.'
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
      `File is too large. Use a file smaller than ${limit}.`
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
    throw new Error('User is not logged in.');
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
    throw new Error('Could not get the media URL.');
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
    toast('Enter a challenge title.');
    return;
  }

  if (
    currentType !== 'text' &&
    !captureUrl
  ) {
    toast('Add a photo, video or audio file.');
    return;
  }

    let mediaUrl = null;

  if (
    currentType !== 'text' &&
    captureBlob
  ) {
    toast('Uploading media...');

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
      toast('Please log in first.');
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
      'Challenge posted 🔥'
    );

    go('home');

  } catch (error) {

    console.error(
      'Publish error:',
      error
    );

    toast(
      error.message ||
      'Could not post the challenge.'
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

                <strong
                  class="${x.profile ? 'profile-link comment-profile-link' : ''}"
                  ${x.profile ? `data-profile-id="${escapeAttr(x.profile)}" data-profile-name="${escapeAttr(x.name)}"` : ''}>
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

  modalCard
    .querySelectorAll('.comment-profile-link')
    .forEach(el => {
      el.addEventListener('click', () => {
        const userId = el.dataset.profileId || '';
        const name = el.dataset.profileName || 'BeatTag User';
        closeModal();
        renderPublicProfile(userId, name);
      });
    });
}

async function addComment(id) {
  const field = $('#commentText');
  if (!field) return;

  const txt = field.value.trim();

  if (!txt) {
    toast('Enter a comment.');
    return;
  }

  try {
    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      toast('Please log in first.');
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
      'Could not save the comment.'
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

      Enter your friend’s name and share this BeatTag challenge.

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
    toast('Enter your friend’s name.');
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
      toast('Please log in first.');
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
      'Could not tag your friend.'
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

  // Root challenges have no parent challenge
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

function normalizeExternalUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const candidate = /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.href;
  } catch (_) {
    return '';
  }
}

function countWords(value = '') {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function profileLinksHTML(link1 = '', link2 = '') {
  const links = [link1, link2]
    .map(normalizeExternalUrl)
    .filter(Boolean);

  if (!links.length) return '';

  return `
    <div class="profile-links">
      ${links.map((url, i) => `
        <a
          href="${escapeAttr(url)}"
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          class="profile-link-button">
          🔗 ${i === 0 ? 'Website' : 'Link 2'}
        </a>
      `).join('')}
    </div>
  `;
}

function renderProfile() {

  const p = profile();

  const mine = state.challenges.filter(
    c => c.creator === currentUserId
  );

  const likes = mine.reduce(
    (s, c) => s + Object.keys(c.likes || {}).length,
    0
  );

  const attempts = mine.reduce(
    (s, c) => s + (c.attempts || 0),
    0
  );

  const maxGen = Math.max(
    1,
    ...mine.map(c => c.generation || 1)
  );

  const owned = SHOP.filter(
    item => isOwned(item.id)
  ).length;

  screenEl.innerHTML = `

    <section class="panel profile-head ${p.equippedTheme ? `profile-theme-${escapeAttr(p.equippedTheme)}` : ''}">

      <div class="profile-avatar ${p.equippedFrame ? `equipped-${escapeAttr(p.equippedFrame)}` : ''}">
        ${escapeHTML(p.name)[0] || 'B'}
      </div>

      <h2>${escapeHTML(p.name)}</h2>

      <div class="muted">
        ${escapeHTML(p.handle)}
      </div>

      ${p.bio ? `
        <p class="profile-bio">
          ${escapeHTML(p.bio)}
        </p>
      ` : ''}

      ${profileLinksHTML(p.websiteUrl1, p.websiteUrl2)}

      ${p.equippedBadge ? `<div class="equipped-badge">${escapeHTML(shopItemById(p.equippedBadge)?.name || 'Badge')}</div>` : ''}
      ${p.equippedTheme ? `<div class="equipped-theme-label">Theme: ${escapeHTML(shopItemById(p.equippedTheme)?.name || 'Custom')}</div>` : ''}

      <div style="margin-top:9px">
        <span class="badge">🔥 ${p.streak} day streak</span>
        <span class="badge">🪙 ${p.coins} coins</span>
        <span class="badge">👥 ${followingIds.size} following</span>
        <span class="badge">🎁 ${owned} items</span>
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
        onclick="requestBeatTagNotifications()">
        🔔 Enable Mobile Notifications
      </button>

      <button
        class="secondary"
        style="margin-top:10px; width:100%;"
        onclick="logoutBeatTag()">
        🚪 Logout
      </button>

    </section>

    <div class="grid">
      <div class="stat"><strong>${mine.length}</strong><span>Challenges</span></div>
      <div class="stat"><strong>${attempts}</strong><span>Attempts</span></div>
      <div class="stat"><strong>${likes}</strong><span>Likes received</span></div>
      <div class="stat"><strong>${maxGen}</strong><span>Longest generation</span></div>
    </div>

    ${isAdmin ? `
      <section class="panel" style="margin:16px 0;">
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
      <h2>My Challenges</h2>
      <button class="ghost" onclick="go('shop')">🛍 Shop</button>
    </div>

    <div id="myFeed"></div>
  `;

  const f = $('#myFeed');

  if (!mine.length) {
    f.innerHTML = `
      <div class="empty">
        Create your first challenge.
      </div>
    `;
  } else {
    mine.forEach(c => f.appendChild(challengeCard(c)));
  }
}

async function renderPublicProfile(userId, fallbackName = 'BeatTag User') {
  if (!userId) return;

  if (userId === currentUserId) {
    go('profile');
    return;
  }

  currentTab = 'public-profile';
  stopStream();

  screenEl.innerHTML = `
    <div class="panel">
      <div class="empty">Loading profile...</div>
    </div>
  `;

  try {
    const [profileResult, followersResult, followingResult] = await Promise.all([
      supabaseClient.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabaseClient.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      supabaseClient.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)
    ]);

    if (profileResult.error) throw profileResult.error;

    const publicProfile = profileResult.data;
    const followerCount = followersResult.error ? 0 : (followersResult.count || 0);
    const followingCount = followingResult.error ? 0 : (followingResult.count || 0);

    const posts = state.challenges
      .filter(c => c.creator === userId)
      .sort((a, b) => b.createdAt - a.createdAt);

    const displayName = publicProfile?.name || publicProfile?.username || fallbackName || 'BeatTag User';
    const username = publicProfile?.username ? '@' + String(publicProfile.username).replace(/^@/, '') : '';
    const likes = posts.reduce((sum, c) => sum + Object.keys(c.likes || {}).length, 0);
    const attempts = posts.reduce((sum, c) => sum + (c.attempts || 0), 0);
    const maxGen = Math.max(1, ...posts.map(c => c.generation || 1));
    const joined = publicProfile?.created_at ? new Date(publicProfile.created_at).toLocaleDateString() : '';
    const followed = isFollowing(userId);

    screenEl.innerHTML = `
      <section class="panel public-profile-head premium-profile-head ${publicProfile?.equipped_theme ? `profile-theme-${escapeAttr(publicProfile.equipped_theme)}` : ''}">
        <button class="ghost public-profile-back" onclick="go('home')">← Back</button>

        <div class="profile-avatar public-avatar ${publicProfile?.equipped_frame ? `equipped-${escapeAttr(publicProfile.equipped_frame)}` : ''}">${escapeHTML(displayName)[0] || 'B'}</div>
        <h2>${escapeHTML(displayName)}</h2>
        ${username ? `<div class="muted">${escapeHTML(username)}</div>` : ''}

        <div class="public-social-stats">
          <span><strong>${followerCount}</strong> Followers</span>
          <span><strong>${followingCount}</strong> Following</span>
        </div>

        ${publicProfile?.bio ? `<p class="profile-bio">${escapeHTML(publicProfile.bio)}</p>` : ''}
        ${publicProfile?.equipped_badge ? `<div class="equipped-badge">${escapeHTML(shopItemById(publicProfile.equipped_badge)?.name || 'Badge')}</div>` : ''}
        ${publicProfile?.equipped_theme ? `<div class="equipped-theme-label">Theme: ${escapeHTML(shopItemById(publicProfile.equipped_theme)?.name || 'Custom')}</div>` : ''}
        ${profileLinksHTML(publicProfile?.website_url_1 || '', publicProfile?.website_url_2 || '')}
        ${joined ? `<div class="profile-joined">Joined ${escapeHTML(joined)}</div>` : ''}

        <button class="${followed ? 'secondary' : 'primary'} public-follow-btn" onclick="toggleFollow('${escapeAttr(userId)}')">
          ${followed ? '✓ Following' : '+ Follow'}
        </button>
      </section>

      <div class="grid public-profile-stats">
        <div class="stat"><strong>${posts.length}</strong><span>Challenges</span></div>
        <div class="stat"><strong>${likes}</strong><span>Likes received</span></div>
        <div class="stat"><strong>${attempts}</strong><span>Attempts</span></div>
        <div class="stat"><strong>${maxGen}</strong><span>Longest generation</span></div>
      </div>

      <div class="section-title"><h2>${escapeHTML(displayName)}'s Challenges</h2></div>
      <div id="publicProfileFeed"></div>
    `;

    const feed = $('#publicProfileFeed');
    if (!posts.length) {
      feed.innerHTML = `<div class="empty">No public challenges yet.</div>`;
    } else {
      posts.forEach(c => feed.appendChild(challengeCard(c)));
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error('Public profile error:', err);
    screenEl.innerHTML = `
      <section class="panel">
        <button class="ghost" onclick="go('home')">← Back</button>
        <div class="empty" style="margin-top:14px;">Could not load this profile.</div>
      </section>
    `;
  }
}

async function renderAdminReports() {

  if (!isAdmin) {
    toast('Admin access required.');
    return;
  }

  screenEl.innerHTML = `
  <section style="
    background:linear-gradient(180deg,#15101d 0%,#0d0a12 100%);
    border:1px solid #3b2948;
    border-radius:24px;
    padding:18px;
    box-shadow:0 0 30px rgba(155,60,255,.10);
  ">

    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px;">
      <div>
        <h2 style="margin:0;font-size:24px;">🚩 Reported Challenges</h2>
        <p style="margin:6px 0 0;color:#aaa0b5;font-size:14px;">Review and manage reported content.</p>
      </div>

      <button
        onclick="renderProfile()"
        style="background:#17111f;color:#fff;border:1px solid #42304f;border-radius:14px;padding:10px 14px;font-weight:700;">
        ← Back
      </button>
    </div>

    <div id="adminReports">
      <div class="empty">Loading reports...</div>
    </div>
  </section>
`;

  const box = document.getElementById('adminReports');

  try {
    const { data, error } = await supabaseClient
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
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || !data.length) {
      box.innerHTML = `<div class="empty">✅ No pending reports</div>`;
      return;
    }

    box.innerHTML = data.map(report => {
      const challenge = report.challenges;
      const creatorId = challenge?.creator_id || '';

      return `
        <div class="admin-report-card">
          <div class="admin-report-top">
            <div class="admin-report-reason">🚩 ${escapeHTML(report.reason || 'Report')}</div>
            <div class="admin-report-time">${new Date(report.created_at).toLocaleString()}</div>
          </div>

          <h3>${escapeHTML(challenge?.title || 'Challenge unavailable')}</h3>

          ${challenge?.description ? `
            <div class="admin-report-description">${escapeHTML(challenge.description)}</div>
          ` : ''}

          ${report.details ? `
            <div class="admin-report-details">
              <small>REPORT DETAILS</small>
              <div>${escapeHTML(report.details)}</div>
            </div>
          ` : ''}

          <div class="admin-report-actions">
            <button class="admin-danger" onclick="adminRemoveChallenge('${report.id}','${report.challenge_id}')">🗑 Remove</button>
            <button class="admin-neutral" onclick="adminDismissReport('${report.id}')">✅ Dismiss</button>
          </div>

          ${creatorId ? `
            <div class="admin-user-actions">
              <button onclick="adminModerateUser('${creatorId}','warn')">⚠️ Warn User</button>
              <button onclick="adminModerateUser('${creatorId}','suspend')">⏸ Suspend 7 Days</button>
              <button class="admin-ban" onclick="adminModerateUser('${creatorId}','ban')">🚫 Ban User</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Load admin reports error:', err);
    box.innerHTML = `<div class="empty">Could not load reports.</div>`;
  }
}

async function adminDismissReport(reportId) {
  if (!isAdmin) return;

  try {
    const { error } = await supabaseClient
      .from('reports')
      .update({ status: 'dismissed' })
      .eq('id', reportId);

    if (error) throw error;

    toast('Report dismissed ✅');
    await renderAdminReports();
  } catch (err) {
    console.error('Dismiss report error:', err);
    toast(err.message || 'Could not dismiss the report.');
  }
}

async function adminRemoveChallenge(reportId, challengeId) {
  if (!isAdmin) return;

  if (!confirm('Remove this challenge from BeatTag?')) return;

  try {
    const { error: challengeError } = await supabaseClient
      .from('challenges')
      .update({ status: 'removed' })
      .eq('id', challengeId);

    if (challengeError) throw challengeError;

    const { error: reportError } = await supabaseClient
      .from('reports')
      .update({ status: 'actioned' })
      .eq('id', reportId);

    if (reportError) throw reportError;

    await loadChallengesFromSupabase();
    toast('Challenge removed 🗑');
    await renderAdminReports();
  } catch (err) {
    console.error('Admin remove challenge error:', err);
    toast(err.message || 'Could not remove the challenge.');
  }
}

async function adminModerateUser(userId, action) {
  if (!isAdmin || !userId) return;

  const labels = {
    warn: 'Warn this user?',
    suspend: 'Suspend this user for 7 days?',
    ban: 'Ban this user and remove all active challenges?'
  };

  if (!confirm(labels[action] || 'Apply moderation action?')) return;

  const reason = prompt(
    'Enter a reason (adult content, graphic content, harassment, etc.):',
    'Community Guidelines violation'
  );

  if (reason === null) return;

  try {
    const { error } = await supabaseClient.rpc('admin_moderate_user', {
      target_user_id: userId,
      moderation_action: action,
      moderation_reason: reason.trim() || 'Community Guidelines violation'
    });

    if (error) throw error;

    toast(
      action === 'warn'
        ? 'User warned ⚠️'
        : action === 'suspend'
          ? 'User suspended ⏸'
          : 'User banned 🚫'
    );

    await loadChallengesFromSupabase();
    await renderAdminReports();
  } catch (err) {
    console.error('Admin moderation error:', err);
    toast(err.message || 'Moderation action failed. Run supabase_upgrade.sql first.');
  }
}

function editProfile() {
  const p = profile();

  modal.classList.remove('hidden');

  modalCard.innerHTML = `
    <div class="modal-head">
      <h3>Edit Profile</h3>
      <button class="close" onclick="closeModal()">×</button>
    </div>

    <div class="field">
      <label>Name</label>
      <input id="epName" maxlength="60" value="${escapeAttr(p.name)}">
    </div>

    <div class="field">
      <label>Handle</label>
      <input id="epHandle" maxlength="30" value="${escapeAttr(p.handle)}">
    </div>

    <div class="field">
      <label>Bio <span class="muted">(max 200 words)</span></label>
      <textarea id="epBio" oninput="updateBioWordCount()" placeholder="Tell people about yourself...">${escapeHTML(p.bio || '')}</textarea>
      <div id="bioWordCount" class="field-hint">${countWords(p.bio || '')}/200 words</div>
    </div>

    <div class="field">
      <label>Website / Link 1</label>
      <input id="epWebsite1" inputmode="url" placeholder="https://example.com" value="${escapeAttr(p.websiteUrl1 || '')}">
    </div>

    <div class="field">
      <label>Website / Link 2</label>
      <input id="epWebsite2" inputmode="url" placeholder="https://youtube.com/..." value="${escapeAttr(p.websiteUrl2 || '')}">
    </div>

    <button class="primary" style="width:100%" onclick="saveProfile()">Save</button>
  `;
}

function updateBioWordCount() {
  const field = $('#epBio');
  const counter = $('#bioWordCount');
  if (!field || !counter) return;

  const words = countWords(field.value);
  counter.textContent = `${words}/200 words`;
  counter.classList.toggle('field-error', words > 200);
}

async function saveProfile() {
  const p = profile();

  const name = ($('#epName')?.value || '').trim() || p.name;
  const rawHandle = ($('#epHandle')?.value || '').trim();
  const username = rawHandle
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  const bio = ($('#epBio')?.value || '').trim();
  const rawLink1 = ($('#epWebsite1')?.value || '').trim();
  const rawLink2 = ($('#epWebsite2')?.value || '').trim();

  if (username.length < 3) {
    toast('Handle must be at least 3 characters.');
    return;
  }

  if (countWords(bio) > 200) {
    toast('Bio can contain up to 200 words.');
    return;
  }

  const link1 = rawLink1 ? normalizeExternalUrl(rawLink1) : '';
  const link2 = rawLink2 ? normalizeExternalUrl(rawLink2) : '';

  if (rawLink1 && !link1) {
    toast('Link 1 must be a valid website URL.');
    return;
  }

  if (rawLink2 && !link2) {
    toast('Link 2 must be a valid website URL.');
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({
        name,
        username,
        bio,
        website_url_1: link1 || null,
        website_url_2: link2 || null
      })
      .eq('id', currentUserId);

    if (error) throw error;

    p.name = name;
    p.handle = '@' + username;
    p.bio = bio;
    p.websiteUrl1 = link1;
    p.websiteUrl2 = link2;

    save();
    closeModal();
    renderProfile();
    toast('Profile updated ✅');

  } catch (err) {
    console.error('Profile save error:', err);
    toast(err.message || 'Could not save the profile. Run the database upgrade first.');
  }
}

async function requestBeatTagNotifications() {
  if (!('Notification' in window)) {
    toast('Notifications are not supported in this browser.');
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      localStorage.setItem('beattag_notifications_enabled', '1');
      await showBeatTagNotification(
        'BeatTag notifications enabled 🔔',
        'You will receive live challenge notifications while BeatTag is active.'
      );
      toast('Notifications enabled ✅');
    } else {
      toast('Notification permission was not granted.');
    }
  } catch (err) {
    console.error('Notification permission error:', err);
    toast('Could not enable notifications.');
  }
}

async function showBeatTagNotification(title, body, challengeId = '') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (localStorage.getItem('beattag_notifications_enabled') !== '1') return;

  const options = {
    body,
    icon: './icon-512.png',
    badge: './icon-192.png',
    tag: challengeId ? `challenge-${challengeId}` : 'beattag-general',
    data: {
      url: challengeId
        ? `${location.origin}${location.pathname}#challenge=${encodeURIComponent(challengeId)}`
        : location.href
    }
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch (err) {
    console.warn('Browser notification error:', err);
  }
}

/* =========================
   SHOP ITEMS
========================= */

const SHOP = [
  { id:'frame_neon', icon:'◇', name:'Neon Pulse Frame', desc:'A 30-Days purple-pink profile frame.', cost:300, duration:'30 Days', category:'Frames', slot:'frame', featured:true, rarity:'Epic' },
  { id:'frame_cyber', icon:'⬡', name:'Cyber Edge Frame', desc:'A sharp neon frame for your creator profile.', cost:420, duration:'30 Days', category:'Frames', slot:'frame', rarity:'Legendary' },
  { id:'badge_challenger', icon:'✦', name:'Challenger Badge', desc:'Show that you are here to compete.', cost:180, duration:'30 Days', category:'Badges', slot:'badge', featured:true, rarity:'Rare' },
  { id:'badge_chainmaster', icon:'∞', name:'Chain Master Badge', desc:'A premium badge for challenge-chain builders.', cost:360, duration:'30 Days', category:'Badges', slot:'badge', rarity:'Epic' },
  { id:'theme_galaxy', icon:'✺', name:'Galaxy Theme', desc:'Adds a cosmic accent to your BeatTag profile.', cost:240, duration:'30 Days', category:'Themes', slot:'theme', featured:true, rarity:'Epic' },
  { id:'theme_midnight', icon:'◐', name:'Midnight Theme', desc:'A deeper, cleaner profile style with subtle glow.', cost:200, duration:'30 Days', category:'Themes', slot:'theme', rarity:'Rare' },
  { id:'boost_24h', icon:'↟', name:'Challenge Boost', desc:'Boost one of your active challenges for 24 hours.', cost:120, duration:'Consumable', category:'Boosts', consumable:true, featured:true, rarity:'Power-up' }
];

let currentShopCategory = 'All';
let shopSearchTerm = '';

function shopItemById(id){ return SHOP.find(item => item.id === id) || null; }
function inventoryEntry(id){ return shopInventory.get(id) || null; }
function inventoryQuantity(id){ return Number(inventoryEntry(id)?.quantity || 0); }
function isOwned(id){
  const item=shopItemById(id), inv=inventoryEntry(id);
  if(!item || !inv) return false;
  if(item.consumable) return Number(inv.quantity||0)>0;
  return !inv.expiresAt || inv.expiresAt>Date.now();
}

async function loadShopInventory(){
  shopInventory=new Map();
  if(!currentUserId) return;
  try{
    const {data,error}=await supabaseClient.from('shop_inventory').select('item_id,quantity,expires_at').eq('user_id',currentUserId);
    if(error){ console.warn('Shop inventory unavailable:',error.message||error); return; }
    (data||[]).forEach(row=>shopInventory.set(row.item_id,{quantity:Number(row.quantity||0),expiresAt:row.expires_at?new Date(row.expires_at).getTime():0}));
  }catch(err){ console.warn('Shop inventory load error:',err); }
}

function getShopProgress(){
  const mine=state.challenges.filter(c=>c.creator===currentUserId);
  const likes=mine.reduce((sum,c)=>sum+Object.keys(c.likes||{}).length,0);
  const attempts=mine.reduce((sum,c)=>sum+Number(c.attempts||0),0);
  const score=Math.max(0,mine.length*20+likes*3+attempts*5+followingIds.size*2);
  return {mine,likes,attempts,score,level:Math.max(1,Math.floor(score/100)+1),levelProgress:score%100};
}
function equippedItemName(slot){
  const p=profile(); const id=slot==='frame'?p.equippedFrame:slot==='badge'?p.equippedBadge:p.equippedTheme;
  return shopItemById(id)?.name||'None';
}

function dailyRewardClaimedToday(){
  const stamp=Number(profile().dailyRewardClaimedAt||0);
  if(!stamp) return false;
  const d=new Date(stamp), now=new Date();
  return d.getUTCFullYear()===now.getUTCFullYear() && d.getUTCMonth()===now.getUTCMonth() && d.getUTCDate()===now.getUTCDate();
}

async function claimDailyReward(){
  if(!currentUserId) return toast('Please log in first.');
  const button=document.getElementById('dailyRewardBtn'); if(button) button.disabled=true;
  try{
    const {data,error}=await supabaseClient.rpc('claim_daily_shop_reward'); if(error) throw error;
    const result=Array.isArray(data)?data[0]:data;
    profile().coins=Number(result?.coins??profile().coins); save();
    const reward=Number(result?.reward??0);
    if(reward>0) profile().dailyRewardClaimedAt=Date.now();
    toast(reward>0?`Daily reward claimed: +${reward} coins 🪙`:'Daily reward already claimed today.');
    renderShop();
  }catch(err){
    console.error('Daily reward error:',err);
    toast(err?.message||'Could not claim the daily reward.');
    if(button) button.disabled=false;
  }
}

async function buyItem(id){
  const item=shopItemById(id); if(!item||!currentUserId) return;
  const button=document.querySelector(`[data-buy-item="${id}"]`); if(button) button.disabled=true;
  try{
    const {data,error}=await supabaseClient.rpc('purchase_shop_item',{requested_item_id:id}); if(error) throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(result?.coins!==undefined) profile().coins=Number(result.coins);
    await loadShopInventory(); save(); toast(`${item.name} unlocked.`); renderShop();
  }catch(err){
    console.error('Shop purchase error:',err);
    toast(String(err?.message||'Purchase failed.'));
    if(button) button.disabled=false;
  }
}

async function equipShopItem(id){
  const item=shopItemById(id); if(!item?.slot||!isOwned(id)) return;
  try{
    const {error}=await supabaseClient.rpc('equip_shop_item',{requested_item_id:id,requested_slot:item.slot}); if(error) throw error;
    if(item.slot==='frame') profile().equippedFrame=id;
    if(item.slot==='badge') profile().equippedBadge=id;
    if(item.slot==='theme') profile().equippedTheme=id;
    save(); toast(`${item.name} equipped.`); renderShop();
  }catch(err){ console.error('Equip item error:',err); toast(err?.message||'Could not equip this item.'); }
}

function openShopPreview(id){
  const item=shopItemById(id); if(!item) return;
  const p=profile();
  const frameClass=item.slot==='frame'?`equipped-${escapeAttr(item.id)}`:(p.equippedFrame?`equipped-${escapeAttr(p.equippedFrame)}`:'');
  const themeClass=item.slot==='theme'?`profile-theme-${escapeAttr(item.id)}`:(p.equippedTheme?`profile-theme-${escapeAttr(p.equippedTheme)}`:'');
  const badgeName=item.slot==='badge'?item.name:(shopItemById(p.equippedBadge)?.name||'');
  modal.classList.remove('hidden');
  modalCard.innerHTML=`
    <div class="modal-head"><div><h3 style="margin:0">${escapeHTML(item.name)}</h3><p class="muted" style="margin:6px 0 0">Preview before you unlock it.</p></div><button class="close" onclick="closeModal()">✕</button></div>
    <section class="shop-preview-card ${themeClass}">
      <div class="profile-avatar ${frameClass}">${escapeHTML(p.name||'B')[0]||'B'}</div>
      <h3>${escapeHTML(p.name||'BeatTag User')}</h3>
      <div class="muted">${escapeHTML(p.handle||'@beattag')}</div>
      ${badgeName?`<div class="equipped-badge">${escapeHTML(badgeName)}</div>`:''}
      <p>${escapeHTML(item.desc)}</p>
    </section>
    <button class="primary" style="width:100%;margin-top:12px" onclick="closeModal();go('shop')">Back to Shop</button>`;
}

function openBoostPicker(){
  if(inventoryQuantity('boost_24h')<1) return toast('Unlock a Challenge Boost first.');
  const mine=state.challenges.filter(c=>c.creator===currentUserId);
  modal.classList.remove('hidden');
  modalCard.innerHTML=`<div class="modal-head"><div><h3 style="margin:0">Boost a Challenge</h3><p class="muted" style="margin:6px 0 0">Your selected challenge gets a 24-hour feed boost.</p></div><button class="close" onclick="closeModal()">✕</button></div><div class="boost-picker-list">${mine.length?mine.map(c=>`<button class="boost-picker-item" onclick="useChallengeBoost('${escapeAttr(c.id)}')"><strong>${escapeHTML(c.title||'Untitled Challenge')}</strong><span>${(c.boostedUntil||0)>Date.now()?'Already boosted':'Boost for 24 hours'}</span></button>`).join(''):'<div class="empty">Create a challenge first.</div>'}</div>`;
}

async function useChallengeBoost(challengeId){
  try{
    const {data,error}=await supabaseClient.rpc('use_challenge_boost',{target_challenge_id:challengeId}); if(error) throw error;
    const result=Array.isArray(data)?data[0]:data; const challenge=state.challenges.find(c=>c.id===challengeId);
    if(challenge&&result?.boosted_until) challenge.boostedUntil=new Date(result.boosted_until).getTime();
    await loadShopInventory(); save(); closeModal(); toast('Challenge boosted for 24 hours.'); if(currentTab==='home') renderHome();
  }catch(err){ console.error('Challenge boost error:',err); toast(err?.message||'Could not boost this challenge.'); }
}

function renderShopItem(container,item,compact=false){
  if(!container) return;
  const owned=isOwned(item.id), quantity=inventoryQuantity(item.id), p=profile();
  const equipped=item.slot==='frame'?p.equippedFrame===item.id:item.slot==='badge'?p.equippedBadge===item.id:item.slot==='theme'?p.equippedTheme===item.id:false;
  const primaryAction=item.consumable
    ? (owned?`<button class="secondary" onclick="openBoostPicker()">Use Boost (${quantity})</button>`:`<button class="primary" data-buy-item="${item.id}" onclick="buyItem('${item.id}')">🪙 ${item.cost}</button>`)
    : (owned?`<button class="${equipped?'secondary':'primary'}" ${equipped?'disabled':''} onclick="equipShopItem('${item.id}')">${equipped?'✓ Equipped':'Equip'}</button>`:`<button class="primary" data-buy-item="${item.id}" onclick="buyItem('${item.id}')">🪙 ${item.cost}</button>`);
  const preview=item.slot?`<button class="ghost shop-preview-btn" onclick="openShopPreview('${item.id}')">Preview</button>`:'';
  container.insertAdjacentHTML('beforeend',`<article class="shop-item ${compact?'featured-item':''}"><div class="shop-item-top"><div class="shop-icon">${item.icon}</div><span class="shop-rarity">${escapeHTML(item.rarity||'')}</span></div><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.desc)}</p><div class="shop-meta"><span>${escapeHTML(item.category)}</span><span>${escapeHTML(item.duration)}</span></div><div class="shop-card-actions">${preview}${primaryAction}</div></article>`);
}

function getFilteredShopItems(){
  const q=shopSearchTerm.trim().toLowerCase();
  return SHOP.filter(item=>{
    const categoryMatch=currentShopCategory==='All' || (currentShopCategory==='Owned'?isOwned(item.id):item.category===currentShopCategory);
    const searchMatch=!q || `${item.name} ${item.desc} ${item.category} ${item.rarity}`.toLowerCase().includes(q);
    return categoryMatch && searchMatch;
  });
}

function setShopCategory(category){
  currentShopCategory=category;
  renderShopCatalog();
}
function setShopSearch(value){
  shopSearchTerm=String(value||'');
  renderShopCatalog();
}

function renderShopCollections(){
  const container=$('#shopCollections'); if(!container) return;
  const categories=['Frames','Badges','Themes','Boosts'];
  container.innerHTML=categories.map(category=>{
    const items=SHOP.filter(item=>item.category===category);
    const owned=items.filter(item=>isOwned(item.id)).length;
    return `<button class="collection-card" onclick="setShopCategory('${category}')"><span>${category==='Frames'?'◇':category==='Badges'?'✦':category==='Themes'?'✺':'↟'}</span><div><strong>${category}</strong><small>${owned}/${items.length} unlocked</small></div></button>`;
  }).join('');
}

function renderShopCatalog(){
  const items=getFilteredShopItems();
  const featuredItems=items.filter(item=>item.featured);
  const featuredSection=$('#featuredSection');
  const featured=$('#featuredShop');
  const store=$('#shop');
  const count=$('#shopItemCount');
  document.querySelectorAll('.shop-tabs button[data-category]').forEach(btn=>btn.classList.toggle('active',btn.dataset.category===currentShopCategory));
  if(featured){
    featured.innerHTML='';
    featuredItems.forEach(item=>renderShopItem(featured,item,true));
  }
  if(featuredSection) featuredSection.classList.toggle('hidden',featuredItems.length===0);
  if(store){
    store.innerHTML='';
    if(items.length){ items.forEach(item=>renderShopItem(store,item,false)); }
    else { store.innerHTML='<div class="empty shop-empty">No shop items match this filter.</div>'; }
  }
  if(count) count.textContent=`${items.length} item${items.length===1?'':'s'}`;
  renderInventoryItems();
}

function renderShop(){
  const progress=getShopProgress(), passTiers=[100,250,500,800], dailyClaimed=dailyRewardClaimedToday();
  const inventoryCount=[...shopInventory.values()].reduce((sum,item)=>sum+Math.max(0,Number(item.quantity||0)),0);
  screenEl.innerHTML=`
    <section class="shop-hero premium-shop-hero"><div class="shop-eyebrow">BEATTAG REWARDS</div><div class="shop-hero-row"><div><h2>Shop & Rewards</h2><p>Earn BeatCoins through challenges. Unlock cosmetics, boosts and profile upgrades.</p></div><div class="shop-balance"><span>BeatCoins</span><strong>🪙 ${profile().coins}</strong></div></div><div class="shop-level-wrap"><div class="shop-level-head"><strong>Level ${progress.level}</strong><span>${progress.levelProgress}/100 XP</span></div><div class="shop-level-track"><span style="width:${progress.levelProgress}%"></span></div></div></section>
    <section class="daily-reward-card"><div class="daily-reward-icon">✦</div><div><strong>Daily Reward</strong><p>Claim your daily BeatCoins and keep your challenge momentum going.</p></div><button id="dailyRewardBtn" class="primary" ${dailyClaimed ? 'disabled' : ''} onclick="claimDailyReward()">${dailyClaimed ? '✓ Claimed Today' : 'Claim +10'}</button></section>
    <div class="shop-search"><input type="search" value="${escapeAttr(shopSearchTerm)}" placeholder="Search rewards, frames, themes..." oninput="setShopSearch(this.value)" aria-label="Search BeatTag Shop"></div>
    <div class="shop-tabs" role="tablist">
      ${['All','Frames','Badges','Themes','Boosts','Owned'].map(category=>`<button data-category="${category}" class="${currentShopCategory===category?'active':''}" onclick="setShopCategory('${category}')">${category}</button>`).join('')}
    </div>
    <div class="section-title"><h2>Collections</h2><span class="muted">Build your style</span></div><div id="shopCollections" class="shop-collections"></div>
    <section id="featuredSection"><div class="section-title"><h2>Featured</h2><span class="muted">Curated for BeatTag</span></div><div class="shop-grid" id="featuredShop"></div></section>
    <section class="challenge-pass-card"><div class="challenge-pass-head"><div><span class="shop-eyebrow">CHALLENGE PASS</span><h3>Season Progress</h3></div><strong>${progress.score} XP</strong></div><div class="pass-track">${passTiers.map((tier,i)=>`<div class="pass-tier ${progress.score>=tier?'done':''}"><span>${i+1}</span><small>${tier} XP</small></div>`).join('')}</div><p>Complete challenges, earn likes, grow attempts and follow creators to progress.</p></section>
    <section class="shop-activity-card"><div><strong>${progress.mine.length}</strong><span>Challenges</span></div><div><strong>${progress.likes}</strong><span>Likes</span></div><div><strong>${progress.attempts}</strong><span>Attempts</span></div><div><strong>${followingIds.size}</strong><span>Following</span></div></section>
    <div class="section-title"><h2>Store</h2><span class="muted" id="shopItemCount">${SHOP.length} items</span></div><div class="shop-grid" id="shop"></div>
    <div class="section-title"><h2>My Inventory</h2><span class="muted">${inventoryCount} owned</span></div><section class="inventory-panel"><div class="inventory-summary"><span><strong>${equippedItemName('frame')}</strong><small>Frame</small></span><span><strong>${equippedItemName('badge')}</strong><small>Badge</small></span><span><strong>${equippedItemName('theme')}</strong><small>Theme</small></span></div><div id="inventoryItems" class="inventory-items"></div></section>`;
  renderShopCollections();
  renderShopCatalog();
}

function renderInventoryItems(){
  const container=$('#inventoryItems'); if(!container) return; const ownedItems=SHOP.filter(item=>isOwned(item.id));
  if(!ownedItems.length){ container.innerHTML='<div class="empty">Your unlocked items will appear here.</div>'; return; }
  container.innerHTML=ownedItems.map(item=>`<button class="inventory-chip" onclick="${item.consumable?"openBoostPicker()":`openShopPreview('${item.id}')`}"><span>${item.icon}</span><div><strong>${escapeHTML(item.name)}</strong><small>${item.consumable?`${inventoryQuantity(item.id)} available`:'Unlocked'}</small></div></button>`).join('');
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
    async (payload) => {
      const isNewChallenge = payload?.eventType === 'INSERT';
      const newId = payload?.new?.id;
      const creatorId = payload?.new?.creator_id;

      await loadChallengesFromSupabase();
      await Promise.all([
        loadReactionsFromSupabase(),
        loadCommentsFromSupabase(),
        loadTagsFromSupabase()
      ]);

      if (isNewChallenge && newId && creatorId !== currentUserId) {
        const challenge = state.challenges.find(c => c.id === newId);

        if (challenge) {
          state.notifications.unshift({
            text: `🔥 New challenge by ${challenge.creatorName}: ${challenge.title}`,
            time: Date.now(),
            read: false
          });
          save();

          await showBeatTagNotification(
            `🔥 ${challenge.creatorName} posted a challenge`,
            challenge.title,
            challenge.id
          );
        }
      }

      if (currentTab === 'home') {
        renderHome();
      }
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
      if (currentTab === 'home') {
  renderHome();
}
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
      if (currentTab === 'home') {
  renderHome();
}
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
      if (currentTab === 'home') {
  renderHome();
}
    }
  )
  .subscribe((status) => {
    console.log('BeatTag Realtime:', status);
  });
