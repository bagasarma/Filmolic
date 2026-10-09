// fetch-movies.js
const fs = require("fs");

try {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(\w+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const TOKEN = process.env.TMDB_TOKEN;
if (!TOKEN) {
  console.error("TMDB_TOKEN belum diisi.");
  process.exit(1);
}

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p"; 
const headers = { Authorization: `Bearer ${TOKEN}`, accept: "application/json" };

// 60 Daftar film yang akan ditarik
const titles = [
  ["Dune: Part Two", 2024], ["Oppenheimer", 2023], ["Inception", 2010], ["Interstellar", 2014], 
  ["The Dark Knight", 2008], ["Parasite", 2019], ["Spider-Man: Across the Spider-Verse", 2023], 
  ["Everything Everywhere All at Once", 2022], ["Mad Max: Fury Road", 2015], ["Blade Runner 2049", 2017], 
  ["Whiplash", 2014], ["La La Land", 2016], ["The Matrix", 1999], ["Avengers: Endgame", 2019],
  ["Joker", 2019], ["John Wick: Chapter 4", 2023], ["The Batman", 2022], ["Top Gun: Maverick", 2022], 
  ["Avatar: The Way of Water", 2022], ["Gladiator", 2000], ["Titanic", 1997], ["Jurassic Park", 1993], 
  ["The Lord of the Rings: The Return of the King", 2003], ["Forrest Gump", 1994], ["The Shawshank Redemption", 1994], 
  ["Pulp Fiction", 1994], ["Fight Club", 1999], ["Goodfellas", 1990], ["Se7en", 1995], ["The Silence of the Lambs", 1991],
  ["Spirited Away", 2001], ["Coco", 2017], ["Inside Out", 2015], ["Up", 2009], ["Toy Story", 1995], 
  ["Finding Nemo", 2003], ["The Lion King", 1994], ["Catch Me If You Can", 2002], ["The Hunger Games: Catching Fire", 2013], 
  ["Iron Man", 2008], ["Black Panther", 2018], ["Guardians of the Galaxy", 2014], ["Deadpool", 2016],
  ["Logan", 2017], ["Wonder Woman", 2017], ["Aquaman", 2018], ["Spider-Man: No Way Home", 2021], 
  ["Doctor Strange", 2016], ["Thor: Ragnarok", 2017], ["Star Wars: A New Hope", 1977], 
  ["The Empire Strikes Back", 1980], ["Return of the Jedi", 1983], ["Dune", 2021], ["Arrival", 2016], 
  ["Sicario", 2015], ["Prisoners", 2013], 
  // 4 Film Tambahan
  ["The Godfather", 1972], ["Terminator 2: Judgment Day", 1991], ["Back to the Future", 1985], ["The Avengers", 2012]
];

async function tmdb(path, params = {}) {
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, { headers });
  if (!res.ok) throw new Error(`TMDB error ${res.status} pada ${path}`);
  return res.json();
}

async function main() {
  const { genres } = await tmdb("/genre/movie/list", { language: "id" });
  const genreName = Object.fromEntries(genres.map((g) => [g.id, g.name]));
  const movies = [];

  for (let i = 0; i < titles.length; i++) {
    const [title, year] = titles[i];
    const { results } = await tmdb("/search/movie", { query: title, year, language: "en-US" });
    const m = results.find((r) => r.poster_path);
    if (!m) continue;

    const credits = await tmdb(`/movie/${m.id}/credits`);
    const cast = credits.cast.slice(0, 5).map(actor => ({
      name: actor.name,
      photo: actor.profile_path ? `${IMG}/w185${actor.profile_path}` : null
    }));

    const isPremium = i % 2 !== 0; 

    movies.push({
      id: m.id,
      title: m.title,
      year: Number((m.release_date || "").slice(0, 4)) || year,
      genre: genreName[m.genre_ids[0]] || "Film",
      rating: Math.round(m.vote_average * 10) / 10,
      poster: `${IMG}/w500${m.poster_path}`,
      backdrop: m.backdrop_path ? `${IMG}/w780${m.backdrop_path}` : "",
      overview: m.overview,
      is_premium: isPremium,
      cast: cast 
    });
    console.log(`OK  ${m.title}`);
  }

  fs.writeFileSync("movies.json", JSON.stringify(movies, null, 2));
  console.log(`\nSelesai: ${movies.length} film ditulis ke movies.json`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});