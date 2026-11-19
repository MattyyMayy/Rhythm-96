import './styles.css';
import { initWriter } from './ui/writer.js';
import { initPanel } from './ui/panel.js';

// Writer first: the panel's animation loop drives the writer's playhead.
initWriter();
initPanel();
