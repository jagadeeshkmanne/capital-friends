// One place that sets Ionic up (Material look everywhere) and loads its CSS + our colours. Phones only.
import { setupIonicReact } from '@ionic/react'
import './ionic-theme.css'

let done = false
if (!done) { setupIonicReact({ mode: 'md', rippleEffect: true, animated: true }); done = true }
