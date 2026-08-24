import './style.css'
import { enableCardExpand } from './expand'
import { enableFooterReveal } from './footer-reveal'
import { startIntro } from './intro'
import { enableBoardLayout } from './layout'
import { enablePager } from './pager'
import { enableAnimationToggle } from './prefs'
import { enableReservations } from './reserve'

enableBoardLayout()
enablePager()
enableAnimationToggle()
enableFooterReveal()
startIntro()
enableCardExpand()
enableReservations()
