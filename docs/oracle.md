# The attention oracle

One word, one article, one number a day.

The catalogue maps each word to a Wikipedia article title. Every day after the previous UTC day is published, the worker asks the Wikimedia pageviews API how many people opened that article, divides by one thousand and pushes the result to the feed as the price in USD. A floor keeps the price above zero.

Why views and not a search index: the numbers are absolute, public, free and stable. A search index is normalised to a window, so a new peak rewrites yesterday. Views do not.

Limits, shown on every word page: the feed goes stale after thirty six hours without a push and the vault pauses that word; a coin can only be sold back up to what it collected; views can be pushed for a day by a crowd. The catalogue is curated by the operator to keep articles honest.
