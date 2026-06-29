import './polyfills'; // must run before any code that calls crypto.randomUUID
import './global.css';
import { enableScreens } from 'react-native-screens';
import { registerRootComponent } from 'expo';
import { App } from './App';

enableScreens();

registerRootComponent(App);
