import { getPlugin } from './helper.js';
import { createSvgStr } from '../utils.js';
import { CalendarDays } from 'lucide';

const type = 'date';

const icon = createSvgStr(CalendarDays);

export default getPlugin({ type, icon });
