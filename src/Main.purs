module Main where

import Prelude

import Control.Monad.Aff (Aff(), runAff)
import Control.Monad.Eff (Eff())
import Control.Monad.Eff.Exception (throwException)
import Control.Monad.Eff.Random
import Data.Array
import Data.Traversable

import Halogen
import Halogen.Util (appendToBody, onLoad)
import qualified Halogen.HTML.Indexed as H
import qualified Halogen.HTML.Events.Indexed as E

data Query a = ToggleState a

type State = { on :: Array Int }

initialState :: State
initialState = { on: [0,0,0] }

ui :: forall eff. Component State Query (Aff (random::RANDOM | eff))
ui = component render eval
  where

  render :: State -> ComponentHTML Query
  render state =
    H.div_ (map (\i -> button i state) [0,1,2])

  button i state = H.button
          [ E.onClick (E.input_ ToggleState) ]
          [ H.text (show (state.on !! i))
          ]
      

  eval :: Natural Query (ComponentDSL State Query (Aff (random::RANDOM | eff)))
  eval (ToggleState next) = do
    die <- liftEff' (sequence [randomInt 1 6, randomInt 1 6, randomInt 1 6])
    modify (\state -> { on: die })
    pure next

main :: forall eff. Eff (HalogenEffects (random::RANDOM | eff)) Unit
main = runAff throwException (const (pure unit)) $ do
  app <- runUI ui initialState
  onLoad $ appendToBody app.node
