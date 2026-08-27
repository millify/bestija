import './style.css'
import { enableMenuAllergens } from './menu-allergens'
import { enableMenuTabs } from './menu-tabs'
import { enableCardExpand } from './expand'
import { enableFooterReveal } from './footer-reveal'
import { startIntro } from './intro'
import { enableBoardLayout } from './layout'
import { enablePager } from './pager'
import { enableAnimationToggle } from './prefs'
import { enableReservations } from './reserve'
import { enableReserveTabs } from './reserve-tabs'
import { enableStoryGallery } from './story-gallery'
import { enableStoryTabs } from './story-tabs'

enableBoardLayout()
enablePager()
enableAnimationToggle()
enableFooterReveal()
startIntro()
enableCardExpand()
enableMenuTabs()
enableMenuAllergens()
enableStoryTabs()
enableStoryGallery()
enableReserveTabs()
enableReservations()
