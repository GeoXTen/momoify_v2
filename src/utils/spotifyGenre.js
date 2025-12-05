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
        return true;
    } catch (error) {
        console.error('Failed to refresh Spotify token:', error.message);
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
            console.log(`🎵 Audio features - Energy: ${audioFeatures.energy?.toFixed(2)}, Tempo: ${audioFeatures.tempo?.toFixed(0)}, Danceability: ${audioFeatures.danceability?.toFixed(2)}`.gray);
        } catch (error) {
            console.log(`⚠️ Could not get audio features: ${error.message}`.yellow);
        }
        
        // Build recommendations options
        const options = {
            limit: limit,
            seed_tracks: [trackId]
        };
        
        // Add artist seed if available
        if (artistId) {
            options.seed_artists = [artistId];
        }
        
        // Add audio feature targets for better recommendations
        if (audioFeatures) {
            // Use target values based on current track features
            if (audioFeatures.energy !== undefined) {
                options.target_energy = audioFeatures.energy;
            }
            if (audioFeatures.danceability !== undefined) {
                options.target_danceability = audioFeatures.danceability;
            }
            if (audioFeatures.valence !== undefined) {
                options.target_valence = audioFeatures.valence; // mood
            }
        }
        
        // Get recommendations from Spotify
        const recommendations = await spotifyApi.getRecommendations(options);
        
        if (!recommendations.body.tracks?.length) {
            console.log(`⚠️ No Spotify recommendations found`.yellow);
            return null;
        }
        
        console.log(`✓ Got ${recommendations.body.tracks.length} Spotify recommendations`.green);
        
        // Return track info for each recommendation
        return recommendations.body.tracks.map(t => ({
            title: t.name,
            artist: t.artists.map(a => a.name).join(', '),
            spotifyUrl: t.external_urls?.spotify,
            spotifyId: t.id,
            duration: t.duration_ms,
            album: t.album?.name
        }));
        
    } catch (error) {
        console.error('Spotify recommendations error:', error.message);
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
