import SpotifyWebApi from 'spotify-web-api-node';
import 'dotenv/config';

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

let tokenExpiry = 0;

async function refreshToken() {
    if (Date.now() < tokenExpiry) return true;
    
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body.access_token);
        tokenExpiry = Date.now() + (data.body.expires_in - 60) * 1000;
        console.log('✓ Spotify token refreshed'.green);
        return true;
    } catch (error) {
        const errorMsg = error?.body?.error_description || error?.body?.error || error?.message || JSON.stringify(error);
        console.error(`Failed to refresh Spotify token: ${errorMsg}`.red);
        return false;
    }
}

export async function getSpotifyRecommendations(trackTitle, artistName, limit = 10) {
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        return null;
    }
    
    try {
        if (!await refreshToken()) return null;
        
        // Search for the track on Spotify to get track ID
        const searchQuery = `${trackTitle} ${artistName}`.substring(0, 100);
        const searchResult = await spotifyApi.searchTracks(searchQuery, { limit: 1 });
        
        if (!searchResult.body.tracks?.items?.length) {
            console.log(`⚠️ Could not find track on Spotify: ${trackTitle}`.yellow);
            return null;
        }
        
        const track = searchResult.body.tracks.items[0];
        const trackId = track.id;
        const artistId = track.artists[0]?.id;
        
        console.log(`🎵 Found Spotify track: ${track.name} by ${track.artists[0]?.name}`.cyan);
        
        // Get audio features for the track (energy, tempo, danceability, etc.)
        let audioFeatures = null;
        try {
            const featuresResult = await spotifyApi.getAudioFeaturesForTrack(trackId);
            audioFeatures = featuresResult.body;
            console.log(`🎵 Audio features - Energy: ${audioFeatures.energy?.toFixed(2)}, Tempo: ${audioFeatures.tempo?.toFixed(0)}, Danceability: ${audioFeatures.danceability?.toFixed(2)}, Valence: ${audioFeatures.valence?.toFixed(2)}`.gray);
        } catch (error) {
            console.log(`⚠️ Could not get audio features: ${error.message}`.yellow);
        }
        
        // Get artist genres for genre seeding
        let artistGenres = [];
        if (artistId) {
            try {
                const artistInfo = await spotifyApi.getArtist(artistId);
                artistGenres = artistInfo.body.genres || [];
                if (artistGenres.length > 0) {
                    console.log(`🎵 Artist genres: ${artistGenres.slice(0, 3).join(', ')}`.gray);
                }
            } catch (error) {
                // Ignore genre fetch errors
            }
        }
        
        // Build recommendations options with Spotify-style algorithm
        const options = {
            limit: limit,
            seed_tracks: [trackId]
        };
        
        // Add artist seed if available (max 5 seeds total across tracks, artists, genres)
        if (artistId) {
            options.seed_artists = [artistId];
        }
        
        // Add genre seed if we have room (max 5 seeds total)
        // Only add 1 genre to leave room for track + artist seeds
        if (artistGenres.length > 0 && (!options.seed_artists || options.seed_artists.length < 2)) {
            options.seed_genres = [artistGenres[0]];
        }
        
        // Enhanced audio feature targeting (Spotify-style content-based filtering)
        if (audioFeatures) {
            // Energy - how intense/active the track feels (0.0 to 1.0)
            if (audioFeatures.energy !== undefined) {
                options.target_energy = audioFeatures.energy;
                // Allow 20% variance for variety
                options.min_energy = Math.max(0, audioFeatures.energy - 0.2);
                options.max_energy = Math.min(1, audioFeatures.energy + 0.2);
            }
            
            // Danceability - how suitable for dancing (0.0 to 1.0)
            if (audioFeatures.danceability !== undefined) {
                options.target_danceability = audioFeatures.danceability;
                options.min_danceability = Math.max(0, audioFeatures.danceability - 0.15);
                options.max_danceability = Math.min(1, audioFeatures.danceability + 0.15);
            }
            
            // Valence - musical positivity/mood (0.0 = sad, 1.0 = happy)
            if (audioFeatures.valence !== undefined) {
                options.target_valence = audioFeatures.valence;
                options.min_valence = Math.max(0, audioFeatures.valence - 0.25);
                options.max_valence = Math.min(1, audioFeatures.valence + 0.25);
            }
            
            // Tempo - BPM (important for EDM/dance music)
            if (audioFeatures.tempo !== undefined && audioFeatures.tempo > 0) {
                options.target_tempo = audioFeatures.tempo;
                // Allow 15 BPM variance
                options.min_tempo = Math.max(60, audioFeatures.tempo - 15);
                options.max_tempo = Math.min(200, audioFeatures.tempo + 15);
            }
            
            // Instrumentalness - vocal vs instrumental (0.0 = vocals, 1.0 = instrumental)
            if (audioFeatures.instrumentalness !== undefined) {
                // Only set if track is notably instrumental or vocal
                if (audioFeatures.instrumentalness > 0.5) {
                    options.min_instrumentalness = 0.3; // Prefer more instrumental
                } else if (audioFeatures.instrumentalness < 0.2) {
                    options.max_instrumentalness = 0.5; // Prefer more vocal
                }
            }
            
            // Acousticness - electronic vs acoustic
            if (audioFeatures.acousticness !== undefined) {
                if (audioFeatures.acousticness > 0.7) {
                    options.min_acousticness = 0.4; // Prefer acoustic
                } else if (audioFeatures.acousticness < 0.3) {
                    options.max_acousticness = 0.5; // Prefer electronic
                }
            }
        }
        
        // Get recommendations from Spotify
        const recommendations = await spotifyApi.getRecommendations(options);
        
        if (!recommendations.body.tracks?.length) {
            console.log(`⚠️ No Spotify recommendations found`.yellow);
            return null;
        }
        
        console.log(`✓ Got ${recommendations.body.tracks.length} Spotify recommendations (content-based + collaborative filtering)`.green);
        
        // Return track info for each recommendation
        return recommendations.body.tracks.map(t => ({
            title: t.name,
            artist: t.artists.map(a => a.name).join(', '),
            spotifyUrl: t.external_urls?.spotify,
            spotifyId: t.id,
            duration: t.duration_ms,
            album: t.album?.name,
            popularity: t.popularity // Include popularity score
        }));
        
    } catch (error) {
        const errorMsg = error?.body?.error?.message || error?.message || JSON.stringify(error);
        console.error(`Spotify recommendations error: ${errorMsg}`.red);
        if (error?.body) {
            console.error('Spotify API response:', JSON.stringify(error.body, null, 2));
        }
        return null;
    }
}

export async function getGenreFromSpotify(trackTitle, artistName) {
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        return null;
    }
    
    try {
        if (!await refreshToken()) return null;
        
        // Search for the track on Spotify
        const searchQuery = `${trackTitle} ${artistName}`.substring(0, 100);
        const searchResult = await spotifyApi.searchTracks(searchQuery, { limit: 1 });
        
        if (!searchResult.body.tracks?.items?.length) {
            return null;
        }
        
        const track = searchResult.body.tracks.items[0];
        const artistId = track.artists[0]?.id;
        
        if (!artistId) return null;
        
        // Get artist info which includes genres
        const artistInfo = await spotifyApi.getArtist(artistId);
        const genres = artistInfo.body.genres || [];
        
        if (genres.length === 0) return null;
        
        // Prioritize specific genres
        const priorityGenres = [
            'dubstep', 'brostep', 'riddim', 'tearout',
            'lofi', 'lo-fi', 'chillhop',
            'edm', 'electro house', 'big room', 'progressive house',
            'trap', 'hybrid trap',
            'drum and bass', 'dnb', 'liquid dnb',
            'phonk', 'drift phonk',
            'hardstyle', 'rawstyle',
            'trance', 'psytrance',
            'techno', 'hard techno',
            'future bass', 'melodic bass',
            'house', 'deep house', 'tech house',
            'hip hop', 'rap', 'r&b',
            'pop', 'rock', 'metal', 'indie'
        ];
        
        // Find the best matching genre
        for (const priority of priorityGenres) {
            for (const genre of genres) {
                if (genre.toLowerCase().includes(priority)) {
                    console.log(`🎵 Spotify detected genre: ${genre} for ${artistName}`.magenta);
                    return genre;
                }
            }
        }
        
        // Return first genre if no priority match
        console.log(`🎵 Spotify detected genre: ${genres[0]} for ${artistName}`.magenta);
        return genres[0];
        
    } catch (error) {
        console.error('Spotify genre detection error:', error.message);
        return null;
    }
}
