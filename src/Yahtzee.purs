module Yahtzee where

import Prelude
import Data.Array
import Data.Maybe
import Data.Foldable

data Category = Aces
              | Twos

score :: Category -> Array Int -> Maybe Int
score Aces = scorePips 1
score Twos = scorePips 2

scorePips :: Int -> Array Int -> Maybe Int
scorePips n dice = Just (sum (filter (==n) dice))
