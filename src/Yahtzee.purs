module Yahtzee where

import Prelude
import Data.Array
import Data.Maybe
import Data.Foldable
import Control.Monad.Eff
import Control.Monad.Eff.Exception

data Category = Aces
              | Twos
	      | Threes
	      | Fours
	      | Fives
	      | Sixes

parse :: forall eff. String -> Eff (err :: EXCEPTION | eff) Category
parse "Aces" = pure Aces
parse "Twos" = pure Twos
parse "Threes" = pure Threes
parse "Fours" = pure Fours
parse "Fives" = pure Fives
parse "Sixes" = pure Sixes
parse _ = throw "aaaaaaaa"

scoreStr :: forall eff. String -> Array Int -> Eff (err :: EXCEPTION | eff) (Maybe Int)
scoreStr categoryStr dice = do
  category <- parse categoryStr
  return (score category dice)
--scoreStr categoryStr dice = (parse categoryStr) >>= \category -> return (score category dice)

score :: Category -> Array Int -> Maybe Int
score Aces = scorePips 1
score Twos = scorePips 2
score Threes = scorePips 3
score Fours = scorePips 4
score Fives = scorePips 5
score Sixes = scorePips 6

scorePips :: Int -> Array Int -> Maybe Int
scorePips n dice = Just (sum (filter (==n) dice))
