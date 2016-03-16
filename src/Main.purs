module Main where

import Prelude

import Control.Monad.Aff (Aff(), runAff)
import Control.Monad.Eff (Eff())
import Control.Monad.Eff.Exception (throwException)
import Control.Monad.Eff.Random
import Data.Maybe

import Halogen
import Halogen.Util (appendToBody, onLoad)
import qualified Halogen.HTML.Indexed as H
import qualified Halogen.HTML.Events.Indexed as E

import Yahtzee


data Query a = ScoreQuery Category a

type ScoreField = { category :: Category, score :: Maybe Int }
type State = { scores :: Array ScoreField }

initialState :: State
initialState = { scores: [ 
                           { category: Aces, score: Nothing },
                           { category: Twos, score: Just 4 }
                         ]
               }

ui :: forall eff. Component State Query (Aff (random::RANDOM | eff))
ui = component render eval
  where

  render :: State -> ComponentHTML Query
  render state =
    H.table_ [
      H.tbody_ (map renderScoreField state.scores)
    ]

  renderScoreField sf = H.tr_ [
                          H.td_ [ H.text (showCategory sf.category) ],
                          H.td props [ H.text label ]
                        ]
    where props = if isJust sf.score then [ E.onClick (E.input_ (ScoreQuery sf.category)) ] else [] 
          label = show sf.score
          showCategory Aces = "Einser"
          showCategory Twos = "Zweier"
          showCategory _ = "not yet translated"

  eval :: Natural Query (ComponentDSL State Query (Aff (random::RANDOM | eff)))
  eval (ScoreQuery category next) = do
--    die <- liftEff' (sequence [randomInt 1 6, randomInt 1 6, randomInt 1 6])
    modify (\state -> { scores: map setScore state.scores })
    pure next
      where setScore sf = if sf.category == category then { category: category, score: Just 123 } else sf

main :: forall eff. Eff (HalogenEffects (random::RANDOM | eff)) Unit
main = runAff throwException (const (pure unit)) $ do
  app <- runUI ui initialState
  onLoad $ appendToBody app.node
