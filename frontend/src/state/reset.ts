import { reset as resetLibrary } from "./library";
import { resetPlayerQueue } from "./player";
import { reset as resetPlaylists } from "./playlists";
import { reset as resetSavedVideos } from "./savedVideos";
import { reset as resetSearch } from "./search";
import { reset as resetSettings } from "./settings";
import { resetVideo } from "./video";

/**
 * Wipe every per-user client store. Called by App.tsx on logout and whenever an
 * API call reports 401 (`resonar:session-expired`), so no data from the previous
 * user survives into the login gate.
 */
export function resetStores() {
  resetLibrary();
  resetPlaylists();
  resetSavedVideos();
  resetSearch();
  resetSettings();
  resetPlayerQueue();
  resetVideo();
}
