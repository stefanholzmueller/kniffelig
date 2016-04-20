module Main where

import Prelude

import Control.Monad.Aff (Aff())
import Control.Monad.Aff.Free (fromEff)
import Control.Monad.Eff (Eff())
import Control.Monad.Eff.Random
import Data.Array (alterAt, filter, length, range, replicate, zip)
import Data.Foldable (any, find)
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
type State = { dice :: Array Die
             , rerolls :: Int
             , scores :: Array Score
             , game :: GameState
             }
type Die = { marked :: Boolean, value :: Int }

data Query a = ScoreQuery Category a
	     | Roll a
             | MarkDie Int a
             | Restart a

ui :: forall eff. Component State Query (Aff (AppEffects eff))
ui = component { render, eval }
  where
  render :: State -> ComponentHTML Query
  render state =
    H.div_ [
      H.div_ (map renderDieWithIndex (zipWithIndex state.dice)),
      H.button [ E.onClick (E.input_ Roll), P.enabled (rerollsAllowed && anyDieMarked) ] [ H.text "Markierte Würfel nochmal werfen" ],
      H.p_ [ H.text if rerollsAllowed
                    then "Noch " ++ show rerollsPossible ++ " Wiederholungs" ++ (if rerollsPossible == 1 then "wurf" else "würfe") ++ " möglich"
                    else "Alle Würfe sind aufgebraucht - eine Kategorie werten oder streichen!"
      ],
      H.table_ [
        H.tbody_ $ map renderScoreRow upperSectionScores
                ++ [ H.tr_ [
                       H.td_ [ H.text "Zwischensumme" ],
                       H.td_ [ H.text $ show $ state.game.sumUpperSection ]
                   ] ]
                ++ [ H.tr_ [
                       H.td_ [ H.text "Bonus" ],
                       H.td_ [ H.text $ show $ state.game.bonusUpperSection ]
                   ] ]
                ++ [ H.tr_ [
                       H.td_ [ H.text "Zwischensumme oberer Teil" ],
                       H.td_ [ H.text $ show $ state.game.finalUpperSection ]
                   ] ]
                ++ map renderScoreRow lowerSectionScores
                ++ [ H.tr_ [
                       H.td_ [ H.text "Zwischensumme unterer Teil" ],
                       H.td_ [ H.text $ show $ state.game.sumLowerSection ]
                   ] ]
                ++ [ H.tr_ [
                       H.td_ [ H.text "Endsumme" ],
                       H.td_ [ H.text $ show $ state.game.finalSum ]
                   ] ]
      ],
      H.p_ if state.game.gameOver then [ H.button [ E.onClick (E.input_ Restart) ] [ H.text "Neues Spiel" ] ] else []
    ]
    where
    rerollsAllowed = state.rerolls < maxRerolls
    rerollsPossible = maxRerolls - state.rerolls
    anyDieMarked = any (\d -> d.marked) state.dice
    upperSectionScores = filterForCategories Yahtzee.upperSectionCategories state.scores
    lowerSectionScores = filterForCategories Yahtzee.lowerSectionCategories state.scores
    filterForCategories categories = filter (\sf -> any (==sf.category) categories)
    renderDieWithIndex (Tuple die i) = H.img [ classes, onclick, (P.src ("Dice-" ++ show die.value ++ ".svg")) ]
      where
      classes = P.classes ([ C.className "die" ] ++ if die.marked then [ C.className "marked" ] else [])
      onclick = E.onClick (E.input_ (MarkDie i))

    renderScoreRow s = H.tr_ [
                         H.td_ [ H.text (showCategory s.category) ],
                         if isNothing s.value
                         then showOption
                         else H.td [ P.classes [ C.className "scored" ] ] [ H.text $ showJust s.value ]
                       ]
      where showOption = let option = Yahtzee.score s.category (map (\die -> die.value) state.dice)
                             onclick = E.onClick (E.input_ (ScoreQuery s.category)) 
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
    modify (\state -> state { dice = rerollMarkedDice state.dice ds, rerolls = state.rerolls + 1 })
    pure next
      where rerollMarkedDice oldDice ds = map merge (zip oldDice ds)
            merge (Tuple die d)         = if die.marked then { marked: false, value: d } else die

  eval (MarkDie i next) = do
    modify (\state -> state { dice = if state.rerolls < maxRerolls then toggleDie i state.dice else state.dice })
    pure next
      where toggleDie i dice = fromMaybe dice (alterAt i (\die -> Just die { marked = not die.marked }) dice) 
    
  eval (ScoreQuery category next) = do
    ds <- fromEff randomPips5
    modify (updateScores ds)
    pure next
      where
      updateScores ds state = { scores: newScores
                              , dice: pipsToDice ds
                              , rerolls: 0
                              , game: calculation
                              }
        where calculation = recalculate newScores newScoreColumn
              newScoreColumn = { ones: findScore Aces
                               , twos: findScore Twos
                               , threes: findScore Threes
                               , fours: findScore Fours
                               , fives: findScore Fives
                               , sixes: findScore Sixes
                               , threeOfAKind: findScore ThreeOfAKind
                               , fourOfAKind: findScore FourOfAKind
                               , fullHouse: findScore FullHouse
                               , smallStraight: findScore SmallStraight
                               , largeStraight: findScore LargeStraight
                               , yahtzee: findScore Yahtzee
                               , chance: findScore Chance
                               }
              findScore c = fromMaybe { category: Aces, value: Nothing } $ find (\s -> s.category == c) newScores
              newScores = map setScore state.scores
              setScore sf = if sf.category == category
                            then let option = Yahtzee.score category (map (\die -> die.value) state.dice)
                                  in if isJust option then sf { value = option } else sf { value = Just 0 }
                            else sf

  eval (Restart next) = do
    ds <- fromEff randomPips5
    modify (\state -> makeInitialState ds)
    pure next
    
zipWithIndex :: forall a. Array a -> Array (Tuple a Int)
zipWithIndex array = zip array (range 0 (length array))

randomPips5 :: forall eff. Eff (random :: RANDOM | eff) (Array Int)
randomPips5 = sequence (replicate 5 (randomInt 1 6))

pipsToDice :: Array Int -> Array Die
pipsToDice = map (\d -> { marked: false, value: d })

makeInitialState :: Array Int -> State
makeInitialState ds = let categories = Yahtzee.upperSectionCategories ++ Yahtzee.lowerSectionCategories
                       in { dice: pipsToDice ds
                          , rerolls: 0
                          , scores: map (\c -> { category: c, value: Nothing }) categories
                          , game: { sumUpperSection: 0
                                  , bonusUpperSection: 0
                                  , finalUpperSection: 0
                                  , sumLowerSection: 0
                                  , finalSum: 0
                                  , gameOver: false
                                  }
                          }

main :: forall eff. Eff (AppEffects (eff)) Unit
main = runHalogenAff do
  ds <- fromEff randomPips5
  let initialState = makeInitialState ds
  body <- awaitBody
  runUI ui initialState body
