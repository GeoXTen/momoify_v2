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
