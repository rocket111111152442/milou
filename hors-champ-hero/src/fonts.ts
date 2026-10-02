import { loadFont as loadCourierPrime } from '@remotion/google-fonts/CourierPrime';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';

// Montserrat 800 : titres (le seul « titre » à l'écran est le logo SVG, mais la police
// est chargée pour tout texte de titre ajouté plus tard).
export const montserrat = loadMontserrat('normal', { weights: ['800'], subsets: ['latin'] }).fontFamily;
// Courier Prime : timecode, REC, slogan.
export const courierPrime = loadCourierPrime('normal', { weights: ['400'], subsets: ['latin'] }).fontFamily;
