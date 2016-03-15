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


data Query a = ScoreQuery a

type ScoreField = { category :: Category, score :: Maybe Int }
type State = { scores :: Array ScoreField }

initialState :: State
initialState = { scores: [ { category: Aces, score: Nothing } ] }

ui :: forall eff. Component State Query (Aff (random::RANDOM | eff))
ui = component render eval
  where

  render :: State -> ComponentHTML Query
  render state =
    H.table_ [
      H.tbody_ (map renderScoreField state.scores)
    ]

  renderScoreField scoreField = H.tr_ [
                                  H.td_ [ H.text (showCategory scoreField.category) ],
				  H.td [ E.onClick (E.input_ ScoreQuery) ] [ H.text (show scoreField.score) ]
                                ]
  
  showCategory Aces = "Einser"
  showCategory _ = "not yet translated"

  eval :: Natural Query (ComponentDSL State Query (Aff (random::RANDOM | eff)))
  eval (ScoreQuery next) = do
--    die <- liftEff' (sequence [randomInt 1 6, randomInt 1 6, randomInt 1 6])
    modify (\state -> { scores: [ { category: Aces, score: Just 1 } ] })
    pure next

main :: forall eff. Eff (HalogenEffects (random::RANDOM | eff)) Unit
main = runAff throwException (const (pure unit)) $ do
  app <- runUI ui initialState
  onLoad $ appendToBody app.node