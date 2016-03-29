module Main where

import Prelude

import Control.Monad.Aff (Aff())
import Control.Monad.Aff.Free (fromEff)
import Control.Monad.Eff (Eff())
import Control.Monad.Eff.Random
import Data.Array (alterAt, filter, length, range, replicate, zip)
import Data.Foldable (any, sum)
import Data.Maybe
import Data.Traversable (sequence)
import Data.Tuple

import Halogen
import Halogen.Util (awaitBody, runHalogenAff)
import qualified Halogen.HTML.Core as C
import qualified Halogen.HTML.Indexed as H
import qualified Halogen.HTML.Events.Indexed as E
import qualified Halogen.HTML.Properties.Indexed as P

import Yahtzee


type AppEffects eff = HalogenEffects (random :: RANDOM | eff)
type State = { dice :: Array Die, scores :: Array ScoreField }
type Die = { marked :: Boolean, value :: Int }
type ScoreField = { category :: Category, score :: Maybe Int }

data Query a = ScoreQuery Category a
	     | Roll a
             | MarkDie Int a


upperSectionCategories :: Array Category
upperSectionCategories = [ Aces, Twos, Threes, Fours, Fives, Sixes ]
lowerSectionCategories :: Array Category
lowerSectionCategories = [ ThreeOfAKind, FourOfAKind, FullHouse, SmallStraight, LargeStraight, Yahtzee, Chance ]

ui :: forall eff. Component State Query (Aff (AppEffects eff))
ui = component { render, eval }
  where

  render :: State -> ComponentHTML Query
  render state =
    H.div_ [
      H.div_ (map renderDieWithIndex (zipWithIndex state.dice)),
      H.div_ [
        H.button [ E.onClick (E.input_ Roll) ] [ H.text "Markierte Würfel nochmal werfen" ]
      ],
      H.table_ [
        H.tbody_ $ map renderScoreRow (filterForCategories upperSectionCategories state.scores)
            ++ [ H.tr_ [
                   H.td_ [ H.text "Zwischensumme" ],
                   H.td_ [ H.text $ show $ sumSection (filterForCategories upperSectionCategories state.scores) ]
               ] ]
            ++ map renderScoreRow (filterForCategories lowerSectionCategories state.scores)
            ++ [ H.tr_ [
                   H.td_ [ H.text "Zwischensumme unterer Teil" ],
                   H.td_ [ H.text $ show $ sumSection (filterForCategories lowerSectionCategories state.scores) ]
               ] ]
      ]   
    ]
    where
    sumSection scores = sum $ map (\sf -> fromMaybe 0 sf.score) scores
    filterForCategories categories = filter (\sf -> any (==sf.category) categories)
    renderDieWithIndex (Tuple die i) = H.img [ classes, onclick, (P.src ("Dice-" ++ show die.value ++ ".svg")) ]
      where
      classes = P.classes ([ C.className "die" ] ++ if die.marked then [ C.className "marked" ] else [])
      onclick = E.onClick (E.input_ (MarkDie i))

    renderScoreRow sf = H.tr_ [
                          H.td_ [ H.text (showCategory sf.category) ],
                          if isNothing sf.score
                          then showOption
                          else H.td [ P.classes [ C.className "scored" ] ] [ H.text $ showJust sf.score ]
                        ]
      where showOption = let option = Yahtzee.score sf.category (map (\die -> die.value) state.dice)
                             onclick = E.onClick (E.input_ (ScoreQuery sf.category)) 
                         in if isJust option
                            then H.td [ onclick, P.classes [ C.className "option" ] ] [ H.text $ showJust option ]
                            else H.td [ onclick, P.classes [ C.className "discard" ] ] [ H.text "-" ]
            showJust maybe = show $ fromMaybe 0 maybe
            showCategory Aces = "Einser"
            showCategory Twos = "Zweier"
            showCategory Threes = "Dreier"
            showCategory Fours = "Vierer"
            showCategory Fives = "Fünfer"
            showCategory Sixes = "Sechser"
            showCategory ThreeOfAKind = "Dreierpasch"
            showCategory FourOfAKind = "Viererpasch"
            showCategory FullHouse = "Full House"
            showCategory SmallStraight = "Kleine Straße"
            showCategory LargeStraight = "Große Straße"
            showCategory Yahtzee = "Yahtzee!"
            showCategory Chance = "Chance"

  eval :: Natural Query (ComponentDSL State Query (Aff (AppEffects eff)))
  eval (Roll next) = do
    ds <- fromEff randomPips5
    modify (\state -> state { dice = rerollMarkedDice state.dice ds })
    pure next
      where rerollMarkedDice oldDice ds = map merge (zip oldDice ds)
            merge (Tuple die d)         = if die.marked then { marked: false, value: d } else die

  eval (MarkDie i next) = do
    modify (\state -> state { dice = toggleDie i state.dice })
    pure next
      where toggleDie i dice = fromMaybe dice (alterAt i (\die -> Just die { marked = not die.marked }) dice) 
    
  eval (ScoreQuery category next) = do -- and then roll dice
    ds <- fromEff randomPips5
    modify (updateScores ds)
    pure next
      where
      updateScores ds state = state { scores = map setScore state.scores, dice = pipsToDice ds }
        where setScore sf = if sf.category == category
                            then let option = Yahtzee.score category (map (\die -> die.value) state.dice)
                                  in if isJust option then sf { score = option } else sf { score = Just 0 }
                            else sf

zipWithIndex :: forall a. Array a -> Array (Tuple a Int)
zipWithIndex array = zip array (range 0 (length array))

randomPips5 :: forall eff. Eff (random :: RANDOM | eff) (Array Int)
randomPips5 = sequence (replicate 5 (randomInt 1 6))

pipsToDice :: Array Int -> Array Die
pipsToDice = map (\d -> { marked: false, value: d })

main :: forall eff. Eff (AppEffects (eff)) Unit
main = runHalogenAff do
  ds <- fromEff randomPips5
  let categories = upperSectionCategories ++ lowerSectionCategories
  let initialState = { dice: pipsToDice ds, scores: map (\c -> { category: c, score: Nothing }) categories }
  body <- awaitBody
  runUI ui initialState body
